// app/index.js

import React, {Component} from 'react';
import {Router, Scene} from 'react-native-router-flux';
import HomePage from './routes/HomePage';
import Login from './routes/Login/Login';

export default class App extends Component {
  render() {
    return(
      <Router>
        <Scene key='root'>
          <Scene
            component={Login}
            hideNavBar={true}
            initial={true}
            key='Login'
            title='Login'
          />
          <Scene
            component={HomePage}
            hideNavBar={true}
            key='HomePage'
            title='HomePage'
          />
        </Scene>
      </Router>
    )
  }
}
