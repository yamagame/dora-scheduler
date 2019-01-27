import React, { Component } from 'react';
import ScheduleApp from './components/ScheduleApp';
import ScheduleDemoApp from './components/ScheduleDemoApp';

class App extends Component {
  constructor(props, context) {
    super(props, context);
  }

  render() {
    if (process.env.REACT_APP_MODE === 'demo') {
      return <ScheduleDemoApp />
    }
    return <ScheduleApp />
  }
}

export default App;
