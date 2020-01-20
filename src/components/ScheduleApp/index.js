import React, { Component } from 'react';
import { connect } from 'react-redux'
import './index.css';
import ScheduleView, { Utils } from '../ScheduleView';
import ScheduleEditDialog from '../ScheduleEditDialog';
import ScheduleDataDialog from '../ScheduleDataDialog';
import {
  setParams,
  loadBarData,
  createBarData,
  saveBarData,
  delBarData,
  saveCalendarData,
  loadCalendarData,
} from '../../reducers';
import { SketchPicker } from 'react-color';
import {
  toColor,
  toRGBA,
} from './utils';

import io from 'socket.io-client';
const socket = (process.env.REACT_APP_MODE !== 'demo') ? io('/bar') : {};

const namespace = 'dora-counter';
const manualURL = "https://docs.google.com/presentation/d/1QmfyJHkg_8y5yuyrvERJvfAd0OBPntpdwwdnrJailGo/edit?usp=sharing";

const storage = {
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
      ].filter( v => v !== null ),
      position: storage.getItem('position', {
        x: now,
        y: 0,
      }),
      scale: storage.getItem('scale', 2),
      showEditDialog: false,
      editBar: {
        d: {
          rgba: [ 0, 255, 0, 1],
        },
        i: 0,
      },
      showColorPickerDialog: false,
      color: storage.getItem('color', {
        r: 0,
        g: 0xff,
        b: 0,
        a: 1,
      }),
      menu: storage.getItem('menu', {
        width: 100,
        opened: false,
      }),
      showScheduleDataDialog: false,
      scheduleData: '',
      calendarData: storage.getItem('calendarData', {}),
      focused: true,
    }
  }

  onResize = () => {
    this.setState({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }

  onUpdateSchedule = (params) => {
    this.props.loadBarData(params);
  }

  onMoveCenter = (payload) => {
    const { uuid } = payload;
    this.props.loadBarData({ bars: [{ uuid }] }, barData => {
      barData.some( bar => {
        if (bar.uuid === uuid) {
          this.scheduleView.moveToCenter(bar);
        }
      })
    });
  }

  onMoveDay = (payload) => {
    const d = new Date(payload.time);
    this.scheduleView.moveToDay(d);
  }

  componentDidMount() {
    window.addEventListener('resize', this.onResize, false);
    this.props.loadBarData();
    this.props.loadCalendarData((err, calendarData) => {
      this.setState({
        calendarData,
      })
    })
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
      focused: false,
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
    // storage.setItem('barData', this.state.barData.map( v => {
    //   const t = { ...v }
    //   delete t.selected;
    //   return t;
    // }));
  }

  createBarData = (barData) => {
    const bars = barData.map( v => {
      const t = { ...v }
      delete t.selected;
      return t;
    })
    this.props.createBarData(bars);
    // storage.setItem('barData', this.state.barData.map( v => {
    //   const t = { ...v }
    //   delete t.selected;
    //   return t;
    // }));
  }

  onCreate = (d) => {
    const barData = [ ...this.state.barData ];
    const col = this.state.color;
    d.rgba = [ col.r, col.g, col.b, col.a ];
    barData.push(d);
    this.setState({
      barData,
    }, () => this.createBarData([d]))
  }

  onChange = (event) => {
    if ('bars' in event) {
      this.setState({
        barData: this.state.barData,
      }, () => {
        this.saveBarData(event.bars)
      })
    }
    if ('position' in event) {
      storage.setItem('position', event.position);
    }
    if ('scale' in event) {
      storage.setItem('scale', event.scale);
    }
    if ('menu' in event) {
      storage.setItem('menu', event.menu);
    }
  }

  onClose = () => {
    this.setState({
      showEditDialog: false,
      focused: true,
    })
  }

  onEdited = (bar) => {
    const d = this.scheduleView.setBar(bar);
    this.setState({
      showEditDialog: false,
      focused: true,
    }, () => this.saveBarData([ d ]));
  }

  onSelect = () => {
    this.state.barData.some( bar => {
      if (bar.selected) {
        try {
          const color = {
            r: bar.rgba[0],
            g: bar.rgba[1],
            b: bar.rgba[2],
            a: bar.rgba[3],
          }
          this.setState({
            color,
          })
          storage.setItem('color', color);
        } catch(err) {
        }
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
        const b = {};
        this.state.barData.forEach( d => {
          b[d.uuid] = d;
        })
        delBars.forEach( d => {
          delete b[d.uuid];
        })
        this.props.delBarData(delBars, () => {
          const barData = Object.keys(b).map( uuid => b[uuid] );
          this.props.setParams({ barData }, () => {
            this.setState({
              barData,
            }, () => {
              //console.log(this.state.barData);
            })
          })
        });
      }
    }
  }

  handleChangeColor = (color) => {
    this.setState({
      color: color.rgb,
    }, () => {
      const col = this.state.color;
      storage.setItem('color', col);
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


  openScheduleDataDialog = () => {
    const scheduleData = JSON.stringify(this.state.barData.map( v => {
      const w = { ...v }
      delete w.grid;
      delete w.selected;
      delete w.ox;
      delete w.oy;
      delete w.info;
      w.rgba = toColor(w.rgba)
      return w;
    }), null, '  ');
    this.setState({
      showScheduleDataDialog: true,
      focused: false,
      scheduleData,
    });
  }

  onCloseScheduleData = () => {
    this.setState({
      showScheduleDataDialog: false,
      focused: true,
    })
  }

  onEditedScheduleData = (scheduleData, callback) => {
    const barData =  [ ];
    try {
      const data = JSON.parse(scheduleData);
      data.forEach( v => {
        v.rgba = toRGBA(v.rgba);
        barData.push(v);
      })
    } catch(err) {
      callback(err);
      return;
    }
    this.setState({
      showScheduleDataDialog: false,
      focused: true,
      barData,
    }, () => this.createBarData(barData))
  }

  onEditCalendar = (calendarData) => {
    storage.setItem('calendarData', calendarData);
    if (this.props.saveCalendarData) this.props.saveCalendarData(calendarData)
  }

  onCreateBar = () => {
    this.scheduleView.createBar();
  }

  onDeleteBar = () => {
    this.scheduleView.deleteBar();
  }

  render() {
    const { width, height } = this.state;
    const popover = {
      position: 'absolute',
      zIndex: 1100,
      top: 46,
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
        marginLeft: 0,
        marginTop: 0,
        marginBottom: 0,
        //position: 'absolute',
        top: 0,
      },
      color: {
        width: '42px',
        height: '22px',
        borderRadius: '2px',
        background: `rgba(${ this.state.color.r }, ${ this.state.color.g }, ${ this.state.color.b }, ${ this.state.color.a })`,
      },
    }
    return (
      <div
        className="App"
        style={{
          width: width,
          height: height-20,
        }}
      >
        <div className="App-header">
          <nav className="navbar sticky-top navbar-light bg-light">
            <div style={{ display: 'inherit', }}>
              <button
                style={{ marginRight: 10, }}
                className="btn btn-sm btn-outline-secondary"
                type="button"
                onClick={this.onCreateBar}
              >追加</button>
              <button
                style={{ marginRight: 10, }}
                className="btn btn-sm btn-outline-secondary"
                type="button"
                onClick={this.onDeleteBar}
              >削除</button>
              <div style={ styles.swatch } onClick={ this.changeColor }>
                <div style={ styles.color } />
              </div>
            </div>
            <div>
              <a
                href={manualURL}
                target="manual"
                className="btn btn-sm btn-outline-secondary"
                style={{marginRight: 10}}
                role="button"
              >使い方</a>
              <button
                className="btn btn-sm btn-outline-secondary"
                type="button"
                onClick={this.openScheduleDataDialog}
              >データ</button>
            </div>
          </nav>
        </div>
        <div
          style={{
            width: width-30,
            height: height-30-25+4-25,
            margin: 10,
          }}
        >
          <ScheduleView
            ref={ n => this.scheduleView = n }
            style={{
              width: width-1-20,
              height: height-4-20-25+4-25,
            }}
            position={this.state.position}
            scale={this.state.scale}
            menu={this.state.menu}
            onEdit={this.onEdit}
            onCreate={this.onCreate}
            onMove={this.onMove}
            onSelect={this.onSelect}
            onChange={this.onChange}
            onKeyDown={this.onKeyDown}
            onEditCalendar={this.onEditCalendar}
            barData={this.state.barData}
            calendarData={this.state.calendarData}
            focused={this.state.focused}
            // readonly
          />
        </div>
        <ScheduleEditDialog
          show={this.state.showEditDialog}
          height={this.state.height-360}
          uuid={this.state.editBar.d.uuid}
          text={this.state.editBar.d.text}
          title={this.state.editBar.d.title}
          color={Utils.toColor(this.state.editBar.d.rgba)}
          headingFlag={this.state.editBar.d.headingFlag}
          dateInfo={this.scheduleView ? this.scheduleView.barDateText(this.state.editBar.d) : ''}
          onClose={this.onClose}
          onEdited={this.onEdited}
          readonly={(this.state.editBar.d.info) ? this.state.editBar.d.info.readOnly : false}
        />
        <ScheduleDataDialog
          show={this.state.showScheduleDataDialog}
          text={this.state.scheduleData}
          onClose={this.onCloseScheduleData}
          onEdited={this.onEditedScheduleData}
          height={this.state.height-240}
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
    loadBarData: (params, callback) => dispatch( loadBarData(params, callback) ),
    createBarData: (bars, callback) => dispatch( createBarData(bars, callback) ),
    saveBarData: (bars, callback) => dispatch( saveBarData(bars, callback) ),
    delBarData: (bars, callback) => dispatch( delBarData(bars, callback) ),
    saveCalendarData: (calendarData, callback) => dispatch( saveCalendarData(calendarData, callback) ),
    loadCalendarData: (callback) => dispatch( loadCalendarData(callback) ),
  })
)(App);
