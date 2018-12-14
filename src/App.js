import React, { Component } from 'react';
import { connect } from 'react-redux'
import './App.css';
import ScheduleView, { Utils } from './components/ScheduleView';
import ScheduleEditDialog from './components/ScheduleEditDialog';
import {
  setParams,
  loadBarData,
  saveBarData,
  delBarData,
} from './reducers';
import { SketchPicker } from 'react-color';

import io from 'socket.io-client'
const socket = io('/bar');

const namespace = 'dora-counter';

const AsyncStorage = {
  getItem: function(key, defaultValue) {
    const value = localStorage.getItem(`${namespace}-${key}`);
    return (value !== null) ? JSON.parse(value).data : defaultValue;
  },
  setItem: function(key, value) {
    localStorage.setItem(`${namespace}-${key}`, JSON.stringify({ data: value }));
  },
}

class App extends Component {
  constructor(props, context) {
    super(props, context);
    const now = Utils.dayPosition((new Date()).getTime());
    this.state = {
      width: window.innerWidth,
      height: window.innerHeight,
      barData: [
        //...AsyncStorage.getItem('barData', []),
      ].filter( v => v !== null ),
      position: AsyncStorage.getItem('position', {
        x: now,
        y: 0,
      }),
      scale: AsyncStorage.getItem('scale', 2),
      showEditDialog: false,
      editBar: {
        d: {
          rgba: [ 0, 255, 0, 1],
        },
        i: 0,
      },
      showColorPickerDialog: false,
      color: AsyncStorage.getItem('color', {
        r: 0,
        g: 0xff,
        b: 0,
        a: 1,
      }),
    }
  }

  onResize = () => {
    this.setState({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }

  onUpdateSchedule = () => {
    this.props.loadBarData();
  }

  onMoveCenter = (payload) => {
    const { uuid } = payload;
    this.state.barData.some( bar => {
      if (bar.uuid === uuid) {
        this.scheduleView.moveToCenter(bar);
      }
    })
  }

  onMoveDay = (payload) => {
    const d = new Date(payload.time);
    this.scheduleView.moveToDay(d);
  }

  componentDidMount() {
    window.addEventListener('resize', this.onResize, false);
    this.props.loadBarData();
    socket.on('update-schedule', this.onUpdateSchedule);
    socket.on('move-to-center', this.onMoveCenter);
    socket.on('move-to-day', this.onMoveDay);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.onResize);
    socket.removeListener('update-schedule', this.onUpdateSchedule);
    socket.removeListener('move-to-center', this.onMoveCenter);
    socket.removeListener('move-to-day', this.onMoveDay);
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.barData !== nextProps.barData) {
      this.setState({
        barData: nextProps.barData,
      })
    }
  }

  onEdit = (d) => {
    this.setState({
      showEditDialog: true,
      editBar: d,
    })
  }

  saveBarData = (barData) => {
    const bars = barData.map( v => {
      const t = { ...v }
      delete t.selected;
      return t;
    })
    this.props.saveBarData(bars);
    // AsyncStorage.setItem('barData', this.state.barData.map( v => {
    //   const t = { ...v }
    //   delete t.selected;
    //   return t;
    // }));
  }

  onCreate = (d) => {
    const barData = this.state.barData;
    const col = this.state.color;
    d.rgba = [ col.r, col.g, col.b, col.a ];
    barData.push(d);
    this.setState({
      barData,
    }, () => this.saveBarData([d]))
  }

  onChange = (event) => {
    if ('bars' in event) {
      this.setState({
        barData: event.bars,
      }, () => {
        this.saveBarData(event.bars.filter( bar => bar.selected))
      })
    }
    if ('position' in event) {
      AsyncStorage.setItem('position', event.position);
    }
    if ('scale' in event) {
      AsyncStorage.setItem('scale', event.scale);
    }
  }

  onClose = () => {
    this.setState({
      showEditDialog: false,
    })
  }

  onEdited = (bar) => {
    const d = this.scheduleView.setBar(bar);
    this.setState({
      showEditDialog: false,
    }, () => this.saveBarData([ d ]));
  }

  onSelect = () => {
    this.state.barData.some( bar => {
      if (bar.selected) {
        const color = {
          r: bar.rgba[0],
          g: bar.rgba[1],
          b: bar.rgba[2],
          a: bar.rgba[3],
        }
        this.setState({
          color,
        })
        AsyncStorage.setItem('color', color);
      }
      return bar.selected;
    })
  }

  onKeyDown = (event) => {
    if(event.keyCode === 13) {
      if (event.shiftKey) {
        this.scheduleView.removeLine();
      } else {
        this.scheduleView.insertLine();
      }
    }
    if(event.keyCode === 8 || event.keyCode === 46) {
      const delBars = this.scheduleView.removeSelectedBar();
      if (delBars.length > 0) {
        this.props.delBarData(delBars);
      }
    }
  }

  handleChangeColor = (color) => {
    this.setState({
      color: color.rgb,
    }, () => {
      const col = this.state.color;
      AsyncStorage.setItem('color', col);
      const bars = this.state.barData.filter( bar => bar.selected );
      bars.forEach( bar => {
        if (bar.selected) {
          bar.rgba = [ col.r, col.g, col.b, col.a ];
        }
      })
      this.saveBarData(bars)
      this.scheduleView.updateBarSelectState();
    })
  }

  changeColor = () => {
    this.setState({
      showColorPickerDialog: true,
    })
  }

  render() {
    const { width, height } = this.state;
    const popover = {
      position: 'absolute',
      zIndex: '2',
      top: 26,
      left: 10,
    }
    const cover = {
      position: 'fixed',
      top: '0px',
      right: '0px',
      bottom: '0px',
      left: '0px',
    }
    const styles = {
      swatch: {
        padding: '4px',
        background: '#fff',
        borderRadius: '1px',
        boxShadow: '0 0 0 1px rgba(0,0,0,.1)',
        display: 'inline-block',
        cursor: 'pointer',
        marginLeft: 10,
        marginTop: 0,
        marginBottom: 0,
        position: 'absolute',
        top: 0,
      },
      color: {
        width: '36px',
        height: '16px',
        borderRadius: '2px',
        background: `rgba(${ this.state.color.r }, ${ this.state.color.g }, ${ this.state.color.b }, ${ this.state.color.a })`,
      },
    }
    return (
      <div
        className="App"
        style={{
          width,
          height,
          margin: 0,
        }}
      >
        <div className="App-header">
          <div style={ styles.swatch } onClick={ this.changeColor }>
            <div style={ styles.color } />
          </div>
        </div>
        <div
          style={{
            width: width-30,
            height: height-30-25+4,
            margin: 10,
          }}
        >
          <ScheduleView
            ref={ n => this.scheduleView = n }
            style={{
              width: width-1-20,
              height: height-4-20-25+4,
            }}
            position={this.state.position}
            scale={this.state.scale}
            onEdit={this.onEdit}
            onCreate={this.onCreate}
            onMove={this.onMove}
            onSelect={this.onSelect}
            onChange={this.onChange}
            onKeyDown={this.onKeyDown}
            barData={this.state.barData}
            // readonly
          />
        </div>
        <ScheduleEditDialog
          show={this.state.showEditDialog}
          height={this.state.height-340}
          uuid={this.state.editBar.d.uuid}
          text={this.state.editBar.d.text}
          title={this.state.editBar.d.title}
          color={Utils.toColor(this.state.editBar.d.rgba)}
          onClose={this.onClose}
          onEdited={this.onEdited}
          readonly={(this.state.editBar.d.info) ? this.state.editBar.d.info.readOnly : false}
        />
        { this.state.showColorPickerDialog ? <div style={ popover }>
          <div style={ cover } onClick={() => {
            this.setState({
              showColorPickerDialog: false,
            })
          }}/>
          <SketchPicker
            color={ this.state.color }
            onChange={ this.handleChangeColor }
          />
        </div> : null }
      </div>
    );
  }
}

App.defaultProps = {
  barData: [],
}

export default connect(
  state => ( {
    barData: state.app.barData,
  }),
  dispatch => ( {
    setParams: (payload) => dispatch( setParams(payload) ),
    loadBarData: () => dispatch( loadBarData() ),
    saveBarData: (bars, callback) => dispatch( saveBarData(bars, callback) ),
    delBarData: (bars, callback) => dispatch( delBarData(bars, callback) ),
  })
)(App);
