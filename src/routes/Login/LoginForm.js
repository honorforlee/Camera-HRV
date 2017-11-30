import React , {Component} from 'react';
import {StyleSheet, View, TextInput, Text, TouchableOpacity, AsyncStorage} from 'react-native';
import {Actions} from 'react-native-router-flux';

export default class LoginForm extends Component{

    constructor() {
        super();
        this.state = {
            email: null,
            password: null
        };
    }

    async saveItem(item, selectedValue) {
        try {
            await AsyncStorage.setItem(item, selectedValue);
        } catch (error) {
            console.error('AsyncStorage error: ' + error.message);
        }
    }

    userLogin() {
        if (!this.state.email || !this.state.password) return;
        // TODO: localhost doesn't work because the app is running inside an emulator. Get the IP address with ifconfig.
        // Actions.HomePage();
        fetch('http://er-lab.cs.ucla.edu:443/mobile/login', {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: this.state.email,
                password: this.state.password
            })
        })
        .then((response) => response.json())
        .then((responseData) => {
            if(responseData.success && responseData.role == 'athlete'){
                // TODO : For server middleware ('hasAccess')
                // Transition to the homepage, passing along necessary data
                Actions.HomePage({firstname: responseData.firstname,
                                  lastname: responseData.lastname,
                                  team: responseData.team});
            }
            else if (responseData.role == 'coach') {
                alert('App only usable by athletes.');
                Actions.Login();
            }
            else{
                alert('Wrong username/password');
                Actions.Login();
            }
        })
        .done();
    }


    render() {
        return(
            <View  style = {styles.container}>
                <TextInput
                    placeholder = " username or email"
                    returnKeyType="next"
                    onChangeText={(email) => this.setState({email})}
                    onSubmitEditing = {() => this.passwordInput.focus()}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style = {styles.input} />

                <TextInput
                    placeholder = " password"
                    secureTextEntry = {true}
                    returnKeyType="go"
                    onChangeText={(password) => this.setState({password})}
                    ref = {(input) => this.passwordInput = input}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style = {styles.input} />

                <TouchableOpacity style={styles.buttonContainer} onPress={this.userLogin.bind(this)}>
                    <Text style={styles.buttonText}>Login</Text>
                </TouchableOpacity>
            </View>
    );
    }
}

const styles = StyleSheet.create({
    container:{
        padding: 20
    },
    input:{
        height: 40,
        backgroundColor: 'rgba(255,255,255,0.3)',
        marginBottom: 10
    },
    buttonContainer:{
        backgroundColor: '#2980b9',
        paddingVertical: 10
    },
    buttonText:{
        textAlign:'center',
        fontWeight: '700'
    }
})
