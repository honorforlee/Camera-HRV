import React, { Component } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LoginForm from './LoginForm';

const imageSource = require('../../images/mascot2.png');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3498db',
  },
  logoContainer: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
  },
  logo: {
    resizeMode: 'contain',
    width: 140,
    height: 140,
  },
  title: {
    color: '#FFF',
    marginTop: 15,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 20,
  },
});

export default class Login extends Component {
  render() {
    return (
      <KeyboardAvoidingView behavior="padding" style={styles.container}>
        <View style={styles.logoContainer}>
          <Image
            style={styles.logo}
            source={imageSource}
          />

          <Text style={styles.title}> Sport Analytics HRV </Text>
        </View>
        <View>
          <LoginForm />
        </View>

      </KeyboardAvoidingView>
    );
  }
}
