import React from 'react'
import ReactDOM from 'react-dom'
import {ipcRenderer} from 'electron'
import {shell} from 'electron'
import Config from 'electron-config'
import storage from 'electron-json-storage'
import moment from 'moment'
import _ from 'lodash'

import Peercast from 'js/peercaststation'
import YP from 'js/yp'
import css from 'scss/style'

import HeaderBox from 'jsx/index/header_box'
import FooterBox from 'jsx/index/footer_box'
import TabBox from 'jsx/tab/tab_box'
import ChannelBox from 'jsx/channel/channel_box'
import GuiBox from 'jsx/gui/gui_box'

const config = new Config({
  defaults: { autoUpdate: false, sortKey: "listener", sortOrderBy: "desc", showGuiTab: false }
})

class Index extends React.Component {

  constructor(props){
    super(props)
    this.bindEvents = this.bindEvents.bind(this)
    this.setChannels = this.setChannels.bind(this)
    this.sortChannels = this.sortChannels.bind(this)
    this.loadSettings = this.loadSettings.bind(this)
    this.loadFavorites = this.loadFavorites.bind(this)
    this.findIndexOfChannels = this.findIndexOfChannels.bind(this)
    this.findIndexOfFavorites = this.findIndexOfFavorites.bind(this)
    this.checkElapsed = this.checkElapsed.bind(this)
    this.fetchIndexTxt = this.fetchIndexTxt.bind(this)
    this.startUpdateTimer = this.startUpdateTimer.bind(this)
    this.stopUpdateTimer = this.stopUpdateTimer.bind(this)
    this.switchAutoUpdate = this.switchAutoUpdate.bind(this)
    this.setSearchWord = this.setSearchWord.bind(this)
    this.selectTab = this.selectTab.bind(this)
    this.registFavorite = this.registFavorite.bind(this)
    this.state = {
      ypList: [],
      favorites: [],
      channels: [],
      relays: [],
      status: { isFirewalled: false },
      searchWord: "",
      showGuiTab: config.get('showGuiTab'),
      sort: { key: config.get('sortKey'), orderBy: config.get('sortOrderBy') },
      autoUpdate: config.get('autoUpdate'),
      autoUpdateCount: 0,
      lastUpdateTime: moment().add(-59, 's'),
      updateStatus: 'wait',
      currentTabIndex: 0,
      mainWindowActive: true,
      unread: false
    }
    this.bindEvents()
    this.loadFavorites()
    this.loadSettings()
  }

  bindEvents(){
    // index.txtを取得時
    ipcRenderer.on('asyn-yp-reply', (event, responses) => {
      let newChannels = _.flattenDeep(responses.map((res)=>{
        return this.state.ypList[0].parseIndexTxt(res.text, res.request.url)
      }))
      if(newChannels.length>0){
        this.setChannels(newChannels, (newChannel)=>{
          // 新着チャンネルか
          let channelIndex = this.findIndexOfChannels(newChannel)
          if(channelIndex<0){
            // お気に入りにマッチ&&通知設定されているか
            let favoriteIndex = this.findIndexOfFavorites(newChannel)
            if(favoriteIndex>=0&&this.state.favorites[favoriteIndex].notify){
              // お気に入り通知
              this.notify('★'+newChannel.name, newChannel.desc)
              if(!this.state.mainWindowActive){
                this.setState({ unread: true })
                ipcRenderer.send('asyn-set-trayicon', 'linux')
              }
            }
          }
        })
      }else{
        this.setState({ autoUpdateCount: 60, updateStatus: 'wait' })
      }
    })
    // メインウィンドウを表示
    ipcRenderer.on('index-window-show', (event, tabIndex)=>{
      this.setState({ currentTabIndex: tabIndex })
    })
    // メインウィンドウが非アクティブ時
    ipcRenderer.on('index-window-blur', (event)=>{
      this.setState({ mainWindowActive: false })
    })
    // メインウィンドウがアクティブ時
    ipcRenderer.on('index-window-focus', (event)=>{
      if(this.state.unread){
        ipcRenderer.send('asyn-set-trayicon', 'darwin')
      }
      this.setState({ mainWindowActive: true, unread: false })
    })
    // お気に入りウィンドウを閉じた時
    ipcRenderer.on('asyn-favorite-window-close-reply', (event)=>{
      this.loadFavorites()
    })
    // 設定ウィンドウを閉じた時
    ipcRenderer.on('asyn-settings-window-close-reply', (event)=>{
      this.loadSettings()
    })
    // 検索ショートカット押下時
    ipcRenderer.on('shortcut-search', (event)=>{
      document.getElementById('search-word').focus()
    })
    // タブ左移動右ショートカット押下時
    ipcRenderer.on('shortcut-tab-left', (event)=>{
      if(this.state.currentTabIndex<=0){
        if(this.state.showGuiTab){
          this.setState({ currentTabIndex: 3 })
        }else{
          this.setState({ currentTabIndex: 2 })
        }
      }else{
        this.setState({ currentTabIndex: this.state.currentTabIndex-1 })
      }
    })
    // タブ右移動ショートカット押下時
    ipcRenderer.on('shortcut-tab-right', (event)=>{
      if(this.state.showGuiTab){
        if(this.state.currentTabIndex>=3){
          this.setState({ currentTabIndex: 0 })
        }else{
          this.setState({ currentTabIndex: this.state.currentTabIndex+1 })
        }
      }else{
        if(this.state.currentTabIndex>=2){
          this.setState({ currentTabIndex: 0 })
        }else{
          this.setState({ currentTabIndex: this.state.currentTabIndex+1 })
        }
      }
    })
  }

  // チャンネル情報をセット
  setChannels(channels, call=()=>{}){
    for(let channel of channels){
      call(channel)
    }
    this.setState({
      channels: channels,
      lastUpdateTime: moment(),
      autoUpdateCount: 60,
      updateStatus: 'wait'
    })
  }

  // チャンネルを並び替えて返す
  sortChannels(channels){
    let key = this.state.sort.key
    if(this.state.sort.orderBy=='asc'){
      // 昇順
      return _.sortBy(channels, (item)=>{
        // 数値化処理
        if(key=='time') return _.toInteger(item[key].replace(/:/, ""))
        if(key=='format') return item.getCharCode(item[key])
        return item[key]
      })
    }else{
      return _.sortBy(channels, (item)=>{
        if(key=='time') return - _.toInteger(item[key].replace(/:/, ""))
        if(key=='format') return - item.getCharCode(item[key])
        return - item[key]
      })
    }
  }

  // 設定を読み込む
  loadSettings(call = ()=>{}){
    // YP
    storage.get('ypList', (error, data)=>{
      // ソート
      let sort = { key: config.get('sortKey'), orderBy: config.get('sortOrderBy') }
      let ypList = []
      if(Object.keys(data).length != 0){
        ypList = data.map((yp, index)=>{
          return new YP(yp.name, yp.url)
        })
      }
      this.setState({
        sort: sort,
        ypList: ypList,
        showGuiTab: config.get('showGuiTab'),
        currentTabIndex: 0
      })
    })
  }

  // お気に入り設定を読み込む
  loadFavorites(call = ()=>{}){
    storage.get('favorites', (error, data)=>{
      if(Object.keys(data).length != 0){
        this.setState({ favorites: data })
      }
      call()
    })
  }

  // 最後の更新から30秒経過したか？
  checkElapsed(){
    let now = moment()
    // 差分秒
    let diffSec = Math.round(now.unix() - this.state.lastUpdateTime.unix())
    if(diffSec > 30){
      return true
    }else{
      return false
    }
  }

  // state.channels内のindex位置を返す
  findIndexOfChannels(channel){
    let index = -1
    for(let i=0; i < this.state.channels.length; i++){
      if(channel.name == this.state.channels[i].name&&
         channel.id == this.state.channels[i].id){
        index = i
        break
      }
    }
    return index
  }

  // マッチするstate.favorites内のindex位置を返す
  findIndexOfFavorites(channel){
    let index = -1
    for(let i=0; i<this.state.favorites.length; i++){
      let favorite = this.state.favorites[i]
      // 検索文字欄が空の場合
      if(!favorite.pattern) continue
      let ptn = new RegExp(favorite.pattern, "i")
      // ptnにマッチする AND 検索対象に指定されているか
      if((channel.name.match(ptn)&&favorite.target.name)||
        (channel.genre.match(ptn)&&favorite.target.genre)||
        (channel.detail.match(ptn)&&favorite.target.detail)||
        (channel.comment.match(ptn)&&favorite.target.comment)||
        (channel.url.match(ptn)&&favorite.target.url)||
        (channel.tip.match(ptn)&&favorite.target.tip)){
        index = i
      }else{
        continue
      }
    }
    return index
  }

  // チャンネル一覧を取得
  get channels(){
    return this.sortChannels(this.state.channels)
  }

  // お気に入りチャンネル一覧を取得
  get favoriteChannels(){
    let favoriteChannels = []
    for(let channel of this.channels){
      for(let favorite of this.state.favorites){
        // 検索文字欄が空の場合
        if(!favorite.pattern) continue
        let ptn = new RegExp(favorite.pattern, "i")
        // ptnにマッチする AND 検索対象に指定されているか
        if((channel.name.match(ptn)&&favorite.target.name)||
          (channel.genre.match(ptn)&&favorite.target.genre)||
          (channel.detail.match(ptn)&&favorite.target.detail)||
          (channel.comment.match(ptn)&&favorite.target.comment)||
          (channel.url.match(ptn)&&favorite.target.url)||
          (channel.tip.match(ptn)&&favorite.target.tip)){
          favoriteChannels.push(channel)
        }else{
          continue
        }
      }
    }
    // 重複を除去
    return favoriteChannels.filter((channel, index, self)=>{
      return self.indexOf(channel) === index
    })
  }

  // チャンネルの検索結果一覧を所得
  get searchChannels(){
    if(!this.state.searchWord) return []
    let pattern = new RegExp(this.state.searchWord, 'gi')
    return _.filter(this.channels, (channel)=>{
      if(channel.name.match(pattern)||
         channel.genre.match(pattern)||
         channel.detail.match(pattern)||
         channel.comment.match(pattern)){
           return 1
         }
    })
  }

  // index.txtを取得
  fetchIndexTxt(){
    if(this.checkElapsed()&&this.state.updateStatus!='updating'){
      this.setState({ updateStatus: 'updating' })
      ipcRenderer.send('asyn-yp', this.state.ypList)
    }else if(this.state.updateStatus!='updating'){
      let sec = 30 - Math.round(moment().unix() - this.state.lastUpdateTime.unix())
      if(sec<0) sec = 30
      // エラー通知
      this.notify("更新できませんでした", `30秒以上の間隔をあけて更新してくだい。\n次の更新まで ${sec}秒`)
    }
  }

  // 更新処理を開始
  startUpdateTimer(){
    this.updateTimerId = setInterval(()=>{
      Promise.all([
        this.updateRelays(),
        this.updateStatus(),
        this.updateCount()
      ]).then((values)=>{
        this.setState({
          relays: values[0].result,
          status: values[1].result,
          autoUpdateCount: values[2]
        })
      }).catch((err)=>{
        console.log(err)
      })
    }, 1000)
  }

  // 更新処理を停止
  stopUpdateTimer(){
    clearTimeout(this.updateTimerId)
  }

  updateCount(){
    return new Promise((resolve, reject)=>{
      if(this.state.autoUpdate&&this.state.updateStatus=='wait'){
        // 自動更新ON時の処理
        if(this.state.autoUpdateCount < 1){
          this.fetchIndexTxt()
          resolve(60)
        }else{
          resolve(this.state.autoUpdateCount-1)
        }
      }else{
         // 自動更新OFF時の処理
         resolve(60)
      }
    })
  }

  updateRelays(){
    return new Promise((resolve, reject)=>{
      Peercast.getChannels((err, res)=>{
        if(res && res.status == 200 && !res.error && res.text){
          let json = JSON.parse(res.text)
          resolve(json)
        }else{
          reject(err)
        }
      })
    })
  }

  updateStatus(){
    return new Promise((resolve, reject)=>{
      Peercast.getStatus((err, res)=>{
        if(res && res.status == 200 && !res.error && res.text){
          let json = JSON.parse(res.text)
          resolve(json)
        }else{
          reject(err)
        }
      })
    })
  }

  // 通知
  notify(title="", body=""){
    new Notification(title, {body: body})
  }

  // 設定を初期化
  initialize(){
    storage.clear(()=>{ config.clear() })
  }

  // -------- HeaderUpdateButton --------
  // 自動更新ON/OFF
  switchAutoUpdate(){
    config.set('autoUpdate', !this.state.autoUpdate)
    this.setState({autoUpdate: !this.state.autoUpdate})
  }

  // ----------- HeaderSearch -----------
  // 検索ワードをセット
  setSearchWord(word){
    this.setState({ searchWord: word, currentTabIndex: 2 })
  }

  // -------------- TabBox --------------
  selectTab(tabIndex){
    this.setState({ currentTabIndex: tabIndex })
  }

  // ------------ ChannelItem ------------
  // お気に入り登録
  registFavorite(favoriteIndex, channelName){
    // 正規表現の特殊文字をエスケープ
    channelName = channelName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
    // 検索文字欄が空白でない場合は|を付与しない
    if(this.state.favorites[favoriteIndex].pattern){
      this.state.favorites[favoriteIndex].pattern += '|'
    }
    this.state.favorites[favoriteIndex].pattern += channelName
    this.setState({ favorites: this.state.favorites })
    storage.set('favorites', this.state.favorites)
  }

  componentDidMount(){
    this._isMounted = true
    this.startUpdateTimer()
  }

  componentWillUnmount(){
    this.stopUpdateTimer()
    this._isMounted = false
  }

  render(){
    let components = [
      {
        name: `すべて(${this.state.channels.length})`,
        component:
          <ChannelBox
            channels={this.channels}
            favorites={this.state.favorites}
            registFavorite={this.registFavorite} />
      },
      {
        name: `お気に入り(${this.favoriteChannels.length})`,
        component:
          <ChannelBox
            channels={this.favoriteChannels}
            favorites={this.state.favorites}
            registFavorite={this.registFavorite} />
      },
      {
        name: `検索(${this.searchChannels.length})`,
        component:
          <ChannelBox
            channels={this.searchChannels}
            favorites={this.state.favorites}
            registFavorite={this.registFavorite} />
      }
    ]
    if(this.state.showGuiTab){
      // relaysが空値の瞬間があるので応急処置-------------
      let relays = this.state.relays
      if(relays==undefined||relays==null) relays = []
      // -------------------------------応急処置ここまで
      components.push({
        name: `リレー(${relays.length})`,
        component:
          <GuiBox relays={relays} status={this.state.status} />
      })
    }
    let currentComponent = components[this.state.currentTabIndex].component
    // darwin環境
    let indexClass = global.process.platform == 'darwin' ? "darwin" : ""

    return(
      <div id="index" className={indexClass}>
        <HeaderBox mainWindowActive={this.state.mainWindowActive} autoUpdate={this.state.autoUpdate}
         onClickAutoUpdate={this.switchAutoUpdate} onClickUpdate={this.fetchIndexTxt}
         setSearchWord={this.setSearchWord} />
        <TabBox components={components} currentTabIndex={this.state.currentTabIndex} selectTab={this.selectTab} />
        {currentComponent}
        <FooterBox autoUpdate={this.state.autoUpdate} autoUpdateCount={this.state.autoUpdateCount}
          lastUpdateTime={this.state.lastUpdateTime} updateStatus={this.state.updateStatus} />
      </div>
    )
  }

}

ReactDOM.render(
  <Index />,
  document.getElementById('container')
)
