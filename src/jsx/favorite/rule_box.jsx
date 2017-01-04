import React from 'react'
import css from 'scss/style'
import RuleItem from 'jsx/favorite/rule_item'

module.exports = class RuleBox extends React.Component {

  constructor(props){
    super(props)
    this.onClickItem = this.onClickItem.bind(this)
  }

  onClickItem(index){
    this.props.onClickItem(index)
  }

  render(){
    let ruleItems = this.props.favorites.map((favorite, index)=>{
      return(
        <RuleItem key={index} index={index} current={this.props.current} name={favorite.name} onClickItem={this.onClickItem} />
      )
    })
    return(
      <div id="rule-box">
        <nav id="rule-box-nav">{ruleItems}</nav>
        <button id="favorite-up" className="btn btn-mini btn-default" onClick={this.props.onClickUp}>
          <span className="icon icon-up-bold"></span>
        </button>
        <button id="favorite-down" className="btn btn-mini btn-default" onClick={this.props.onClickDown}>
          <span className="icon icon-down-bold"></span>
        </button>
        <button id="favorite-add" className="btn btn-mini btn-default" onClick={this.props.onClickAdd}>追加</button>
        <button id="favorite-delete" className="btn btn-mini btn-default" onClick={this.props.onClickDelete}>削除</button>
      </div>
    )
  }
}