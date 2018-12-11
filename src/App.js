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

  componentDidMount() {
    window.addEventListener('resize', this.onResize, false);
    this.props.loadBarData();
    socket.on('update-schedule', this.onUpdateSchedule);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.onResize);
    socket.removeListener('update-schedule', this.onUpdateSchedule);
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
    console.log(`saveBarData`, barData.length);
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
    barData.push(d);
    this.setState({
      barData,
    }, () => this.saveBarData([d]))
  }

  onChange = (event) => {
    if ('bars' in event) {
      this.setState({
        barData: event.bars,
      }, () => this.saveBarData(event.bars.filter( bar => bar.selected)))
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

  render() {
    const { width, height } = this.state;
    return (
      <div
        className="App"
        style={{
          width: width-20,
          height: height-20,
          margin: 10,
        }}
      >
        <ScheduleView
          ref={ n => this.scheduleView = n }
          style={{
            width: width-1-20,
            height: height-4-20,
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
