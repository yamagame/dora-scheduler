import React, { Component } from 'react';
import { connect } from 'react-redux'
import './index.css';
import ScheduleView, { Utils, } from '../ScheduleView';
import ScheduleEditDialog from '../ScheduleEditDialog';
import ScheduleDataDialog from '../ScheduleDataDialog';
import { setParams } from '../../reducers';
import { SketchPicker } from 'react-color';
import {
  toColor,
  toRGBA,
} from './utils';

const manualURL = "https://docs.google.com/presentation/d/1QmfyJHkg_8y5yuyrvERJvfAd0OBPntpdwwdnrJailGo/edit?usp=sharing";

const AsyncStorage = {
  getItem: function(key, defaultValue) {
    const value = localStorage.getItem(key);
    return (value !== null) ? JSON.parse(value).data : defaultValue;
  },
  setItem: function(key, value) {
    localStorage.setItem(key, JSON.stringify({ data: value }));
  },
}

class ScheduleApp extends Component {
  constructor(props, context) {
    super(props, context);
    const now = Utils.dayPosition((new Date()).getTime());
    this.state = {
      width: window.innerWidth,
      height: window.innerHeight,
      barData: [
        ...AsyncStorage.getItem('barData', []),
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
      showScheduleDataDialog: false,
      scheduleData: '',
      calendarData: AsyncStorage.getItem('calendarData', {}),
    }
  }

  onResize = () => {
    this.setState({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }

  componentDidMount() {
    window.addEventListener('resize', this.onResize, false);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.onResize);
  }

  onEdit = (d) => {
    this.setState({
      showEditDialog: true,
      editBar: d,
    })
  }

  saveBarData = () => {
    AsyncStorage.setItem('barData', this.state.barData.map( v => {
      const t = { ...v }
      delete t.selected;
      return t;
    }));
  }

  onCreate = (d) => {
    const barData = [ ...this.state.barData ];
    const col = this.state.color;
    d.rgba = [ col.r, col.g, col.b, col.a ];
    barData.push(d);
    this.setState({
      barData,
    }, this.saveBarData)
  }

  onChange = (event) => {
    if ('bars' in event) {
      this.setState({
        barData: this.state.barData,
      }, this.saveBarData)
    }
    if ('newBarData' in event) {
      this.setState({
        barData: [ ...event.newBarData ],
      }, this.saveBarData)
    }
    if ('position' in event) {
      AsyncStorage.setItem('position', event.position);
    }
    if ('scale' in event) {
      AsyncStorage.setItem('scale', event.scale);
    }
  }

  onKeyDown = (event) => {
    if(event.keyCode == 13) {
      if (event.shiftKey) {
        this.scheduleView.removeLine();
      } else {
        this.scheduleView.insertLine();
      }
    }
    if(event.keyCode == 8 || event.keyCode == 46) {
      const delBars = this.scheduleView.removeSelectedBar();
      if (delBars.length > 0) {
        const b = {};
        this.state.barData.forEach( d => {
          b[d.uuid] = d;
        })
        delBars.forEach( d => {
          delete b[d.uuid];
        })
        const barData = Object.keys(b).map( uuid => b[uuid] );
        this.setState({
          barData,
        }, () => this.saveBarData())
      }
    }
  }

  onClose = () => {
    this.setState({
      showEditDialog: false,
    })
  }

  onEdited = (bar) => {
    const barData = [ ...this.state.barData ];
    const d = this.scheduleView.setBar(bar);
    this.setState({
      showEditDialog: false,
      barData,
    }, () => this.saveBarData());
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
          AsyncStorage.setItem('color', color);
        } catch(err) {
        }
      }
      return bar.selected;
    })
  }

  handleChangeColor = (color) => {
    this.setState({
      color: color.rgb,
    }, () => {
      const col = this.state.color;
      AsyncStorage.setItem('color', col);
      const barData = [ ...this.state.barData ];
      const bars = barData.filter( bar => bar.selected );
      bars.forEach( bar => {
        if (bar.selected) {
          bar.rgba = [ col.r, col.g, col.b, col.a ];
        }
      })
      this.setState({
        showEditDialog: false,
        barData,
      }, () => this.saveBarData());
    })
  }

  changeColor = () => {
    this.setState({
      showColorPickerDialog: true,
    })
  }

  openScheduleDataDialog = () => {
    const selectedBars = this.state.barData.filter( v => v.selected );
    const scheduleData = JSON.stringify(((selectedBars.length > 0) ? selectedBars : this.state.barData).map( v => {
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
      scheduleData,
    });
  }

  onCloseScheduleData = () => {
    this.setState({
      showScheduleDataDialog: false,
    })
  }

  onEditedScheduleData = (scheduleData) => {
    const barData =  [ ...this.state.barData ];
    const cursor = this.scheduleView.cursorRectangles();
    try {
      const data = JSON.parse(scheduleData);
      const a = {}
      barData.forEach( v => {
        delete v.selected;
        a[v.uuid] = v;
      })
      data.forEach( v => {
        v.rgba = toRGBA(v.rgba);
        if (a[v.uuid]) {
          Object.keys(v).forEach( k => {
            a[v.uuid][k] = v[k];
          })
        } else {
          if (cursor.visible === 'visible') {
            v.y += cursor.y;
          }
          v.selected = true;
          barData.push(v);
        }
      })
    } catch(err) {
    }
    this.setState({
      showScheduleDataDialog: false,
      barData,
    }, () => this.saveBarData())
  }

  onEditCalendar = (calendarData) => {
    AsyncStorage.setItem('calendarData', calendarData);
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
            onEdit={this.onEdit}
            onCreate={this.onCreate}
            onMove={this.onMove}
            onSelect={this.onSelect}
            onChange={this.onChange}
            onKeyDown={this.onKeyDown}
            onEditCalendar={this.onEditCalendar}
            barData={this.state.barData}
            calendarData={this.state.calendarData}
          />
        </div>
        <ScheduleEditDialog
          show={this.state.showEditDialog}
          height={this.state.height-360}
          uuid={this.state.editBar.d.uuid}
          text={this.state.editBar.d.text}
          title={this.state.editBar.d.title}
          color={Utils.toColor(this.state.editBar.d.rgba)}
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

export default connect(
  state => ( {
  }),
  dispatch => ( {
    setParams: (payload) => dispatch( setParams(payload) ),
  })
)(ScheduleApp);
