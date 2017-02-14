import React from 'react'
import Config from 'electron-config'
import {ipcRenderer} from 'electron'
import {remote} from 'electron'
import {shell} from 'electron'
const config = new Config({
  defaults: { port: 7144, playerPath: '', playerArgs: '"$x"' }
})

import Player from 'js/player'

module.exports = class ChannelItem extends React.Component {

  constructor(props){
    super(props)
    this.play = this.play.bind(this)
    this.openURL = this.openURL.bind(this)
    this.showContextMenu = this.showContextMenu.bind(this)
    this.registFavorite = this.registFavorite.bind(this)
    this.onMiddleClick = this.onMiddleClick.bind(this)
  }

  // プレイヤーで再生する
  play(){
    let player = new Player(this.props.channel)
    player.play()
  }

  // コンタクトURLをBBSブラウザで開く
  openBBS(){
    ipcRenderer.send('asyn-open-bbs', this.props.channel.url)
  }

  // コンタクトURLを既定ブラウザで開く
  openURL(){
    shell.openExternal(this.props.channel.url)
  }

  // お気に入り登録
  registFavorite(favoriteIndex, channelName){
    this.props.registFavorite(favoriteIndex, channelName)
  }

  // 右クリメニューを表示
  showContextMenu(e){
    const clipboard = remote.clipboard
    const Menu =  remote.Menu
    const MenuItem =  remote.MenuItem
    let menu = new Menu()
    menu.append(new MenuItem({
      label: '再生',
      click: ()=>{ this.play() }
    }))
    menu.append(new MenuItem({
      label: 'コンタクトURLを開く',
      click: ()=>{ this.openURL() }
    }))
    menu.append(new MenuItem({
      label: 'BBSブラウザで開く',
      click: ()=>{ this.openBBS() }
    }))
    menu.append(new MenuItem({
      type: 'separator'
    }))
    menu.append(new MenuItem({
      label: 'お気に入りに登録',
      type: 'submenu',
      submenu: this.props.favorites.map((favorite, index)=>{
        return {
          label: favorite.name,
          click: ()=>{ this.registFavorite(index, this.props.channel.name) }
        }
      })
    }))
    menu.append(new MenuItem({
      label: 'コピー',
      type: 'submenu',
      submenu: [
        { label: 'チャンネル名', click: ()=>{ clipboard.writeText(this.props.channel.name) } },
        { label: 'コンタクトURL', click: ()=>{ clipboard.writeText(this.props.channel.url) } },
        { label: 'プレイリストURL', click: ()=>{ clipboard.writeText(this.playListURL) } },
        { label: 'ストリームURL', click: ()=>{ clipboard.writeText(this.streamURL) } },
        { label: 'IPアドレス', click: ()=>{ clipboard.writeText(this.props.channel.tip.replace(/:\d+$/,"")) } },
        { type: 'separator' },
        {
          label: 'チャンネル詳細一行',
          click: ()=>{
            let text = `${this.props.channel.name}(${this.props.channel.listener}/${this.props.channel.relay})`+
                       `[${this.props.channel.genre} - ${this.props.channel.detail}]`
            if(this.props.channel.comment) text += `「${this.props.channel.comment}」`
            clipboard.writeText(text)
          }
        },
        {
          label: 'チャンネル詳細複数行',
          click: ()=>{
            let text = `${this.props.channel.name}(${this.props.channel.listener}/${this.props.channel.relay})\n`+
                       `[${this.props.channel.genre} - ${this.props.channel.detail}]`
            if(this.props.channel.comment) text += `\n「${this.props.channel.comment}」`
            clipboard.writeText(text)
          }
        }
      ]
    }))
    e.preventDefault()
    menu.popup(remote.getCurrentWindow())
  }

  // 中クリック押下時
  onMiddleClick(event){
    if(event.button==1){
      this.openURL()
    }
  }

  get detail(){
    let channel = this.props.channel
    let genre = channel.detail ? `${channel.genre} - ` : channel.genre
    return `${genre}${channel.detail} ${channel.comment} ${channel.track.artist}`
  }

  // プレイリストURLを取得
  get playListURL(){
    let port = config.get('port')
    var url = `http://127.0.0.1:${port}/pls/${this.props.channel.id}?tip=${this.props.channel.tip}`
    return url
  }

  // ストリームURLを取得
  get streamURL(){
    let port = config.get('port')
    var url = `http://127.0.0.1:${port}/stream/${this.props.channel.id}.${this.props.channel.format.toLowerCase()}`
    return url
  }

  // マッチするお気に入り情報があれば取得
  get favorite(){
    let res = null
    for(let favorite of this.props.favorites){
      // 検索文字欄が空の場合
      if(!favorite.pattern) continue
      let ptn = new RegExp(favorite.pattern, "i")
      // ptnにマッチする AND 検索対象に指定されているか
      if((this.props.channel.name.match(ptn)&&favorite.target.name)||
        (this.props.channel.genre.match(ptn)&&favorite.target.genre)||
        (this.props.channel.detail.match(ptn)&&favorite.target.detail)||
        (this.props.channel.comment.match(ptn)&&favorite.target.comment)||
        (this.props.channel.url.match(ptn)&&favorite.target.url)||
        (this.props.channel.tip.match(ptn)&&favorite.target.tip)){
        res = favorite
        break
      }
    }
    return res
  }

  render(){
    let favorite = this.favorite
    let style = {}
    if(favorite){
      style = {
        background: `#${favorite.bgColor}`,
        color: `#${favorite.fontColor}`
      }
    }
    let nameClass = "channel-item-name"
    if(this.props.channel.url) nameClass += " link"
    return(
      <tr className="channel-item"  style={style}
        onClick={this.onMiddleClick}
        onDoubleClick={this.play}
        onContextMenu={this.showContextMenu}>
        <td className="channel-item-col1">
          <div className={nameClass}>{this.props.channel.name}</div>
          <div className="channel-item-detail">{this.detail}</div>
        </td>
        <td className="channel-item-col2">
          <div className="channel-item-listener">{this.props.channel.listener}/{this.props.channel.relay}</div>
          <div className="channel-item-time">{this.props.channel.time}</div>
        </td>
        <td className="channel-item-col3">
          <div className="channel-item-kbps">{this.props.channel.kbps}</div>
          <div className="channel-item-format">{this.props.channel.format}</div>
        </td>
      </tr>
    )
  }

}
