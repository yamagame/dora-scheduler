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
import ScheduleFilePicker from '../ScheduleFilePicker'
import {
  Row,
  Col,
  Button,
  Modal,
} from 'react-bootstrap';

const manualURL = "https://docs.google.com/presentation/d/1QmfyJHkg_8y5yuyrvERJvfAd0OBPntpdwwdnrJailGo/edit?usp=sharing";

const storage = {
  getItem: function(key, defaultValue) {
    const value = localStorage.getItem(key);
    return (value !== null) ? JSON.parse(value).data : defaultValue;
  },
  setItem: function(key, value) {
    localStorage.setItem(key, JSON.stringify({ data: value }));
  },
}

const range = len => {
  const arr = []
  for (let i = 0; i < len; i++) {
    arr.push(i)
  }
  return arr
}

class ScheduleApp extends Component {
  constructor(props, context) {
    super(props, context);

    const now = Utils.dayPosition((new Date()).getTime());
    const files = storage.getItem('scheduleFiles', {});
    const filename = storage.getItem('scheduleFilename', 'MySchedule');
    const barData = storage.getItem('barData', []);

    this.state = {
      width: window.innerWidth,
      height: window.innerHeight,
      barData: [
        ...barData,
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
      files: Object.keys(files),
      filename,
      editMode: true,
      show_create_file: false,
      show_delete_file: false,
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
      focused: false,
      editBar: d,
    })
  }

  saveBarData = () => {
    const barData = this.state.barData.map( v => {
      const t = { ...v }
      delete t.selected;
      return t;
    })
    storage.setItem('barData', barData);
    const files = storage.getItem('scheduleFiles', {});
    if (files[this.state.filename] == null) {
      files[this.state.filename] = {};
    }
    files[this.state.filename].barData = barData;
    files[this.state.filename].position = this.state.position;
    files[this.state.filename].scale = this.state.scale;
    storage.setItem(`scheduleFiles`, files);
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
      storage.setItem('position', event.position);
      this.setState({
        position: event.position,
      }, () => {
        const files = storage.getItem('scheduleFiles', {});
        if (files[this.state.filename] == null) {
          files[this.state.filename] = {};
        }
        files[this.state.filename].position = this.state.position;
        storage.setItem(`scheduleFiles`, files);
      })
    }
    if ('scale' in event) {
      storage.setItem('scale', event.scale);
      this.setState({
        scale: event.scale,
      }, () => {
        const files = storage.getItem('scheduleFiles', {});
        if (files[this.state.filename] == null) {
          files[this.state.filename] = {};
        }
        files[this.state.filename].scale = this.state.scale;
        storage.setItem(`scheduleFiles`, files);
      })
    }
    if ('menu' in event) {
      storage.setItem('menu', event.menu);
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
      focused: true,
    })
  }

  onEdited = (bar) => {
    const barData = [ ...this.state.barData ];
    const d = this.scheduleView.setBar(bar);
    this.setState({
      showEditDialog: false,
      focused: true,
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
          storage.setItem('color', color);
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
      storage.setItem('color', col);
      const barData = [ ...this.state.barData ];
      const bars = barData.filter( bar => bar.selected );
      bars.forEach( bar => {
        if (bar.selected) {
          bar.rgba = [ col.r, col.g, col.b, col.a ];
        }
      })
      this.setState({
        showEditDialog: false,
        focused: true,
        barData,
      }, () => this.saveBarData());
    })
  }

  changeColor = () => {
    this.setState({
      showColorPickerDialog: true,
    })
  }

  openScheduleDataPicker = () => {
    this.saveBarData();
    this.setState({
      files: Object.keys(storage.getItem('scheduleFiles', {})),
      selectFilename: this.state.filename,
      editMode: false,
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
    }, () => this.saveBarData())
  }

  onEditCalendar = (calendarData) => {
    storage.setItem('calendarData', calendarData);
  }

  onCreateBar = () => {
    this.scheduleView.createBar();
  }

  onDeleteBar = () => {
    this.scheduleView.deleteBar();
  }

  createSchedule = (filename) => {
    const files = storage.getItem('scheduleFiles', {});
    if (files[filename]) {
      const { barData, position, scale } = files[filename];
      this.setState({
        barData,
        position,
        scale,
        filename,
        editMode: true,
      }, () => {
        storage.setItem('scheduleFilename', filename);
        this.saveBarData()
      })
    } else {
      files[filename] = {
        barData: [],
        position: this.state.position,
        scale: this.state.scale,
      };
      storage.setItem(`scheduleFiles`, files);
      this.setState({
        barData: [],
        filename,
        editMode: true,
      }, () => {
        storage.setItem('scheduleFilename', filename);
        this.saveBarData()
      })
    }
  }

  deleteSchedule = (filename) => {
    const files = storage.getItem('scheduleFiles', {});
    if (files[filename]) {
      let filenames = Object.keys(storage.getItem('scheduleFiles', {}));
      let i = filenames.indexOf(filename);
      if (i >= 0) {
        let nextfile = 'MySchedule';
        if (filenames.length > 1) {
          if (i+1 >= filenames.length) {
            nextfile = filenames[0];
          } else {
            nextfile = filenames[i+1];
          }
        }
        delete files[filename];
        storage.setItem(`scheduleFiles`, files);
        this.setState({
          files: filenames.filter( f => f !== filename ),
          filename: this.state.filename == filename ? nextfile : this.state.filename,
          selectFilename: nextfile,
        }, () => {
          storage.setItem('scheduleFilename', this.state.filename);
        })
      }
    }
  }

  onSelectSchedule = (filename) => {
    this.setState({
      selectFilename: filename,
    })
  }

  onCreateSchedule = () => {
    this.setState({
      show_create_file: true,
    })
  }

  onOpenSchedule = () => {
    if (this.state.selectFilename && this.state.selectFilename.trim() !== '') {
      this.createSchedule(this.state.selectFilename);
    }
  }

  onDeleteSchedule = () => {
    if (this.state.selectFilename && this.state.selectFilename.trim() !== '') {
      this.setState({
        show_delete_file: true,
      })
    }
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
    if (!this.state.editMode) {
      return <div>
        <ScheduleFilePicker
          width={width}
          height={height}
          filename={this.state.selectFilename}
          data={ this.state.files.map( v => { return { filename: v } }) }
          onClose={() => {
            let selectFilename = this.state.selectFilename;
            let filenames = Object.keys(storage.getItem('scheduleFiles', {}));
            if (filenames.length <= 0) {
              selectFilename = 'MySchedule';
            }
            this.setState({
              editMode: true,
              selectFilename,
            })
          }}
          onSelect={this.onSelectSchedule}
          onCreate={this.onCreateSchedule}
          onOpen={this.onOpenSchedule}
          onDelete={this.onDeleteSchedule}
        />
        <Modal
          show={this.state.show_create_file}
          size="lg"
          onEnter={() => {
            this.setState({
              new_filename: '',
            });
          }}
          onHide={() => {
            this.setState({
              show_create_file: false,
            });
          }}
        >
          <Modal.Header closeButton>
            <Modal.Title>
              新規ファイルの作成
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <label>ファイル名:</label>
            <input
              type="text"
              style={{ width: '100%', }}
              value={this.state.new_filename}
              onChange={ (e) => {
                this.setState({
                  new_filename: e.target.value,
                })
              }}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={() => {
              this.setState({
                show_create_file: false,
              });
            }}>キャンセル</Button>
            <Button onClick={() => {
              if (this.state.new_filename && this.state.new_filename.trim() !== '') {
                this.setState({
                  show_create_file: false,
                }, () => {
                  this.createSchedule(this.state.new_filename);
                });
              }
            }}>作成</Button>
          </Modal.Footer>
        </Modal>
        <Modal
          show={this.state.show_delete_file}
          size="lg"
          onHide={() => {
            this.setState({
              show_delete_file: false,
            });
          }}
        >
          <Modal.Header closeButton>
            <Modal.Title>
              ファイルの削除
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p style={{ fontSize: 16, marginBottom: 10, }} > {`${this.state.selectFilename} を削除しますか？`} </p>
            <p style={{ color: 'red', fontSize: 16, marginBottom: 10, }} > { this.props.filename } </p>
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={() => {
              this.setState({
                show_delete_file: false,
              });
            }}>キャンセル</Button>
            <Button onClick={() => {
              this.setState({
                show_delete_file: false,
              }, () => {
                this.deleteSchedule(this.state.selectFilename);
              });
            }}>削除</Button>
          </Modal.Footer>
        </Modal>
      </div>
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
              {this.state.filename}
            </div>
            <div>
              <button
                className="btn btn-sm btn-outline-secondary"
                type="button"
                style={{marginRight: 10}}
                onClick={this.openScheduleDataPicker}
              >読み込み</button>
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

export default connect(
  state => ( {
  }),
  dispatch => ( {
    setParams: (payload) => dispatch( setParams(payload) ),
  })
)(ScheduleApp);
