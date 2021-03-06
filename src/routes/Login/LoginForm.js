import React, { Component } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Actions } from 'react-native-router-flux';

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  input: {
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginBottom: 10,
  },
  buttonContainer: {
    backgroundColor: '#2980b9',
    paddingVertical: 10,
  },
  buttonText: {
    textAlign: 'center',
    fontWeight: '700',
  },
});

export default class LoginForm extends Component {
  /**
   * Handle errors encountered during the attempt to log in.
   */
  static handleErrors(response) {
    if (!response.ok) {
      alert(response.statusText);
      alert('Unable to log in. Please try again later.');
      Actions.Login();
    }
    return response;
  }

  constructor() {
    super();
    this.state = { email: null, password: null };
  }

  /**
   * Logs the user in. Runs when the login button is pressed.
   */
  userLogin() {
    if (!this.state.email || !this.state.password) {
      return;
    }

    const isConnected = true;
    if (!isConnected) {
      alert('No internet connection. Please check connection and ' +
            'try again.');
      Actions.Login();
    } else {
      fetch('http://er-lab.cs.ucla.edu:443/mobile/login', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: this.state.email,
          password: this.state.password,
        }),
      })
        .then(this.handleErrors)
        .then(response => response.json())
        .then((responseData) => {
          if (!responseData) {
            alert('New Exception');
          }
          if (responseData.success) {
            if (responseData.role === 'athlete') {
              // Transition to the homepage, passing along
              // necessary data
              Actions.HomePage({
                firstname: responseData.firstname,
                lastname: responseData.lastname,
                team: responseData.team,
              });
            } else {
              alert('App only usable by athletes.');
              Actions.Login();
            }
          } else {
            alert('Wrong username/password');
            Actions.Login();
          }
        })
        .done();
    }
  }

  render() {
    return (
      <View style={styles.container}>
        <TextInput
          placeholder=" username or email"
          returnKeyType="next"
          onChangeText={email => this.setState({ email })}
          onSubmitEditing={() => this.passwordInput.focus()}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          style={styles.input}
        />

        <TextInput
          placeholder=" password"
          secureTextEntry
          returnKeyType="go"
          onChangeText={password => this.setState({ password })}
          ref={(input) => { this.passwordInput = input; }}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        <TouchableOpacity style={styles.buttonContainer} onPress={this.userLogin.bind(this)}>
          <Text style={styles.buttonText}> Login </Text>
        </TouchableOpacity>
      </View>
    );
  }
}
