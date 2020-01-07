import React, { Component } from 'react';
import {
  Row,
  Col,
  Button,
  Modal,
} from 'react-bootstrap';
import AceEditor from 'react-ace';
import 'brace/mode/plain_text';
import 'brace/theme/chrome';

const toRGBA = function(text) {
  try {
    if (text.trim().indexOf('#') === 0) {
      const m1 = '^#([0-9,A-F]{2})([0-9,A-F]{2})([0-9,A-F]{2})([0-9,A-F]{2})$';
      const m2 = '^#([0-9,A-F])([0-9,A-F])([0-9,A-F])([0-9,A-F])$';
      const m3 = '^#([0-9,A-F]{2})([0-9,A-F]{2})([0-9,A-F]{2})$';
      const m4 = '^#([0-9,A-F])([0-9,A-F])([0-9,A-F])$';
      const color = text.trim().toUpperCase();
      const t = color.match(m1) || color.match(m2) || color.match(m3) || color.match(m4);
      if (t) {
        const r = parseInt(t[1],16);
        const g = parseInt(t[2],16);
        const b = parseInt(t[3],16);
        const a = (t.length >= 5) ? parseInt(t[4],16)/255 : 1;
        return [ r, g, b, a ];
      }
      return [ 0, 255, 0, 1 ];
    }
  } catch(err) {
  }
  return [ 0, 255, 0, 1 ];
}

export default class ScheduleEditDialog extends Component {
  constructor(props) {
    super(props);
    this.state = {
      title: (props.title === null) ? '' : props.title,
      text: (props.text === null) ? '' : props.text,
      color:  (props.color === null) ? '#00FF00' : props.color,
      headingFlag: (props.headingFlag === null) ? false : props.headingFlag,
    }
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.title !== nextProps.title) {
      this.setState({
        title: (nextProps.title === null) ? '' : nextProps.title,
      })
    }
    if (this.props.text !== nextProps.text) {
      this.setState({
        text: (nextProps.text === null) ? '' : nextProps.text,
      })
    }
    if (this.props.color !== nextProps.color) {
      this.setState({
        color: (nextProps.color === null) ? '#00FF00' : nextProps.color,
      })
    }
    if (this.props.headingFlag !== nextProps.headingFlag) {
      this.setState({
        headingFlag: (nextProps.headingFlag === null) ? false : nextProps.headingFlag,
      })
    }
  }

  onChangeTitle = (e) => {
    this.setState({ title: e.target.value });
  }

  onChangeColor = (e) => {
    this.setState({ color: e.target.value });
  }

  onChangeText = (value) => {
    this.setState({ text: value });
  }

  onChangeHeading = (e) => {
    this.setState({ headingFlag: e.target.checked })
  }

  onClose = () => {
    if (this.props.onClose) {
      this.props.onClose();
    }
  }

  onEdited = () => {
    if (this.props.onEdited) {
      const bar = {
        uuid: this.props.uuid,
        rgba: toRGBA(this.state.color),
        title: this.state.title,
        text: this.state.text,
        headingFlag: (this.state.headingFlag === null) ? false : this.state.headingFlag,
      };
      this.props.onEdited(bar);
    }
  }

  onEnter = () => {
    this.setState({
      title: (this.props.title === null) ? '' : this.props.title,
      text:  (this.props.text === null) ? '' : this.props.text,
      color: (this.props.color === null) ? '' : this.props.color,
      headingFlag: (this.props.headingFlag === null) ? false : this.props.headingFlag,
    })
  }

  render() {
    return (
      <Modal
        show={this.props.show}
        size="lg"
        onHide={this.onClose}
        onEnter={this.onEnter}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            バーの編集
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row>
            <Col md={8} >
              <input
                type="text"
                style={{ fontSize: 16, width: '100%', marginBottom: 10, }}
                value={this.state.title}
                onChange={this.onChangeTitle}
                readOnly={this.props.readonly?'readonly':null}
                placeholder="バーのタイトル"
              />
            </Col>
            <Col md={2} >
              <input
                type="text"
                style={{ fontSize: 16, width: '100%', marginBottom: 10, }}
                value={this.state.color}
                onChange={this.onChangeColor}
                readOnly={this.props.readonly?'readonly':null}
              />
            </Col>
            <Col md={2}>
              <div
                className="form-check"
                style={{ fontSize: 16, width: '100%', marginBottom: 10, paddingTop: 2, }}
              >
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="headingCheckBox"
                  name="headingFlag"
                  checked={this.state.headingFlag}
                  onChange={this.onChangeHeading}
                  readOnly={this.props.readonly?'readonly':null}
                />
                <label className="form-check-label" htmlFor="headingCheckBox">見出し</label>
              </div>
            </Col>
            <Col md={12}>
              {
                <AceEditor
                  ref={ r => this.editor = r }
                  style={{
                    display: 'inline-block',
                    border: 'solid 1px lightgray',
                  }}
                  mode="text"
                  theme="chrome"
                  value={this.state.text}
                  width="100%"
                  height={`${this.props.height}px`}
                  onChange={this.onChangeText}
                  showPrintMargin={false}
                  fontSize={16}
                  name="senario_editor"
                  editorProps={{$blockScrolling: Infinity}}
                  readOnly={this.props.readonly}
                />
              }
            </Col>
            <Col md={12}>
              <p style={{
                textAlign: "right",
                marginBottom: 0,
                marginRight: 8,
              }}>{this.props.dateInfo}</p>
              {/* <input
                type="text"
                style={{ width: '100%', marginBottom: 10, }}
                value={this.props.dateInfo}
                tabIndex={"-1"}
                focusable={false}
                readOnly
              /> */}
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={this.onEdited}>OK</Button>
        </Modal.Footer>
      </Modal>
    )
  }
}

ScheduleEditDialog.defaultProps = {
  uuid: null,
  show: false,
  height: 100,
  title: '',
  text: '',
  color: '##00FF00',
  readonly: false,
}
