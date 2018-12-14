import React, { Component } from 'react';
import {
  Row,
  Col,
  Button,
  Modal,
} from 'react-bootstrap';
import { SketchPicker } from 'react-color';

export default class ScheduleColorPicker extends Component {
  constructor(props) {
    super(props);
  }

  onClose = () => {
    if (this.props.onClose) {
      this.props.onClose();
    }
  }

  onEdited = () => {
    if (this.props.onEdited) {
      this.props.onEdited();
    }
  }

  render() {
    return (
      <Modal
        show={this.props.show}
        onHide={this.onClose}
        onEntered={this.onEntered}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            色の変更
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <SketchPicker />
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={this.onEdited}>OK</Button>
        </Modal.Footer>
      </Modal>
    )
  }
}

ScheduleColorPicker.defaultProps = {
}
