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
      const m1 = '^#([0-9,A-F]{2})([0-9,A-F]{2})([0-9,A-F]{2})$';
      const m2 = '^#([0-9,A-F])([0-9,A-F])([0-9,A-F])$';
      const color = text.trim().toUpperCase();
      const t = color.match(m1) || color.match(m2);
      if (t) {
        const r = parseInt(t[1],16);
        const g = parseInt(t[2],16);
        const b = parseInt(t[3],16);
        return [ r, g, b, 1 ];
      }
      return null;
    }
  } catch(err) {
  }
  return null;
}

export default class ScheduleEditDialog extends Component {
  constructor(props) {
    super(props);
    this.state = {
      title: (props.title === null) ? '' : props.title,
      text: (props.text === null) ? '' : props.text,
      color:  (props.color === null) ? '#00FF00' : props.color,
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
      };
      this.props.onEdited(bar);
    }
  }

  onEntered = () => {
    this.setState({
      title: (this.props.title === null) ? '' : this.props.title,
      text:  (this.props.text === null) ? '' : this.props.text,
      color: (this.props.color === null) ? '' : this.props.color,
    })
  }

  render() {
    return (
      <Modal
        show={this.props.show}
        size="lg"
        onHide={this.onClose}
        onEntered={this.onEntered}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            バーの編集
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row>
            <Col md={9}>
              <input
                type="text"
                style={{ width: '100%', marginBottom: 10, }}
                value={this.state.title}
                onChange={this.onChangeTitle}
                readOnly={this.props.readonly?'readonly':null}
                placeholder="バーのタイトル"
              />
            </Col>
            <Col md={3}>
              <input
                type="text"
                style={{ width: '100%', marginBottom: 10, }}
                value={this.state.color}
                onChange={this.onChangeColor}
                readOnly={this.props.readonly?'readonly':null}
              />
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
                  fontSize={18}
                  name="senario_editor"
                  editorProps={{$blockScrolling: Infinity}}
                  readOnly={this.props.readonly}
                />
              }
            </Col>
            <Col md={12}>
              <input
                type="text"
                style={{ width: '100%', marginBottom: 10, }}
                value={this.props.uuid}
                readOnly
              />
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
