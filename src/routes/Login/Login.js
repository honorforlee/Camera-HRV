import React , {Component} from 'react';
import {StyleSheet, View, Image, Text, KeyboardAvoidingView} from 'react-native';
import LoginForm from './LoginForm'
import {Actions} from 'react-native-router-flux';

export default class Login extends Component{
    render() {
        return(
            <KeyboardAvoidingView behavior = "padding" style = {styles.container}>
                <View style = {styles.logoContainer}>
                    <Image 
                        style = {styles.logo}
                        source = {require('../../images/mascot2.png')}/>
                    <Text style = {styles.title}> Sport Analytics HRV </Text>
                </View>
                <View style = {styles.formContainer}>
                    <LoginForm />
                </View>
                
            </KeyboardAvoidingView>

        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex : 1,
        backgroundColor: '#3498db'
    },
    logoContainer:{
        alignItems: 'center',
        flexGrow: 1,
        justifyContent: 'center'
    },
    logo: {
        resizeMode: 'contain',
        width : 200,
        height : 200
    },
    title:{
        color : '#FFF',
        marginTop: 15,
        textAlign: 'center',
        fontWeight: '700',
        fontSize: 20
    }
})