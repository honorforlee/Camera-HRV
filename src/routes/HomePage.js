import React, { Component } from 'react';
import { AppRegistry, StyleSheet, Text, View, Image, NativeModules, NativeEventEmitter} from 'react-native';
import Svg,{Circle,Rect} from 'react-native-svg';
import { VictoryAxis, VictoryArea, VictoryBar, VictoryLine, VictoryScatter, VictoryChart, VictoryStack, VictoryTheme} from 'victory-native';
import Button from 'react-native-button'
import ProgressBar from 'react-native-progress/Circle'
import {Actions} from 'react-native-router-flux';

//import TransactionVolumeGraph from './TransactionVolumeGraph';

//import PixelColor from 'react-native-pixel-color';

//import { Surface } from "gl-react-native";	
//import Saturate from './Saturate';


var signal = [];
var signal_ac = [];
var chart = [];
var chart2 = [];
var rr = [];
var prev = 0;
var cnt = 0;
var window_idx = 0;
const WINDOW_SIZE = 100;
const SAMPLING_FREQ = 25;


for(i=0; i<WINDOW_SIZE; i++){
    chart.push({time: i, value: 0});
    signal.push([0,0]);
    signal_ac.push(0);
}


var CameraController = require('NativeModules').CameraController;
const myModuleEvt = new NativeEventEmitter(CameraController);

export default class HomePage extends Component {

  constructor(props) {
    super(props);

    // CameraController.start();
    // CameraController.turnTorchOn(true);

  }

    state = {
        width: null,
        height: null,
        isLoggedIn: false,
        path: 'https://facebook.github.io/react/img/logo_og.png',
        rgb: '...',
        hrv: 0,
        torchMode: null,
        signal_avg: 0,
        max_array: 100,
        indeterminate: true,
        hrvProgress: 0,
        int_avg : 50
    }

    update(data){
        //console.log(chart2);
        this.setState({rgb:data});
        signal.shift();
        // signal_ac.shift();
        chart.shift();
        while(chart2.length >=1 ){
            if( chart2[0].time > 0 && chart2[0].time < chart[0].time){
                chart2.shift();
            }
            else
                break;
        }

        if(chart2.length == 0){
            //console.log("chart length: %d",chart.length);
            chart2.push({time:chart[1].time,value:-10});
        }

        cnt += 1;
        window_idx += 1;
        var int_data = parseInt(data);
        // var remove_dc = int_data-this.state.signal_avg/2;

        var new_val = Math.abs(int_data - prev);
        prev = int_data;
        // New RMS alg:
        var rms = Math.pow(signal[WINDOW_SIZE-2][1]-signal[WINDOW_SIZE-3][1],2) + Math.pow(signal[WINDOW_SIZE-3][1]-signal[WINDOW_SIZE-4][1],2) + Math.pow(signal[WINDOW_SIZE-4][1]-signal[WINDOW_SIZE-5][1],2);
        rms = Math.sqrt(rms);
        rms /= 3; 
        //new_val = rms;
        //--------


        chart.push({time: cnt, value: 1000-int_data}); 
        // signal_ac.push(remove_dc);
        signal.push([cnt,int_data]);
        this.state.signal_avg = this.state.signal_avg * 0.9 + parseInt(data) * 0.1;  


        if(window_idx==WINDOW_SIZE-20){
            window_idx = 0;
            this.peakDetection();
            //alert(chart[0].time);
        }
        //this.state.max_array = Math.max.apply(null,signal_ac);
    }

    peakDetection(){
        

        var up = false;
        var upcounter = 0;
        var downcounter = 0;
        var peak_idx = 0;
        var peak_val = 0;;
        var avg = 0;
        for(i=0; i<WINDOW_SIZE-1 ;i++){
            avg += chart[i].value;
            if(up){
                if(chart[i+1].value > chart[i].value){
                    console.log("Up:up, index: ",i," ,Value: ",chart[i].value ,"\n");
                   
                    if(chart[i+1].value > peak_val){
                        peak_idx = i+1;
                        peak_val = chart[i+1].value;
                    }
                }
                else if(chart[i+1].value < chart[i].value){
                    console.log("Up:Down, index: ",i," ,Value: ",chart[i].value ,"\n");
                    downcounter += 1;
                }
                if(downcounter >= 3){
                    upcounter = 0;
                    up = false;
                    console.log("Found Peak going down, index: ",i," ,Value: ",chart[i].value ,"\n");
                    if(peak_val > this.state.int_avg){
                        chart2.push({time:chart[peak_idx].time,value:chart[peak_idx].value});

                        // remove duplicates:
                        if(rr.length != 0){
                            if(chart[peak_idx].time <= rr[rr.length-1].time)
                                {
                                    peak_val = 0;
                                    continue;
                                }
                        }
                        rr.push({time:chart[peak_idx].time,value:chart[peak_idx].value});
                        peak_val = 0;
                    }
                }               
            }
            else{
                if(chart[i+1].value > chart[i].value){
                    console.log("Down:Up, index: ",i," ,Value: ",chart[i].value ,"\n");
                    upcounter +=1 ;
                }
                else if(chart[i+1].value < chart[i].value){
                    console.log("Down:Down, index: ",i," ,Value: ",chart[i].value ,"\n");
                    upcounter -= 0;
                }
                if(upcounter >= 2){
                    console.log("Down:Going up, index: ",i," ,Value: ",chart[i].value ,"\n");
                    downcounter = 0;

                    up = true;
                }

            }
        }

        avg = avg / WINDOW_SIZE-1;
        this.setState({int_avg:Math.floor(avg)});
        console.log("chart2: ",chart2);
    }

    onLayout = (event) => {
        const { width, height } = event.nativeEvent.layout;

        this.setState({
            width,
            height
        });

    }

    refreshPic = () => {
        //console.warn("-- just called refreshPic --\n");
        //alert("test");
        sample_text = "CHANGED";
        //sample_text='qwqwe';
    }

    calculateHRV(){
        sum_rr = 0;
        rmssd = 0;
        rr_cnt = 0;

        avg_rr = 0;
        for(i=1 ; i<rr.length-1 ; i++){
            avg_rr += Math.abs(rr[i+1].time - rr[i].time);
        }
        avg_rr /= rr.length-1;

        var rr_lower_thresh = 0.7;
        var rr_upper_thresh = 1.3;
        for(i=1 ; i<rr.length-1 ; i++){
            // RR correction
            if(Math.abs(rr[i].time - rr[i-1].time) < rr_lower_thresh*avg_rr || Math.abs(rr[i+1].time - rr[i].time) < rr_lower_thresh*avg_rr || Math.abs(rr[i].time - rr[i-1].time) > rr_upper_thresh*avg_rr || Math.abs(rr[i+1].time - rr[i].time) > rr_upper_thresh*avg_rr)
                continue;
            else{
                sum_rr += Math.pow((Math.abs(rr[i+1].time - rr[i].time)-Math.abs(rr[i].time - rr[i-1].time)),2);
                rr_cnt += 1;
            }
        }
        alert("removed "+((rr.length-2)-rr_cnt)+" avg: "+(avg_rr * 1000/SAMPLING_FREQ));
        if(rr_cnt)
            rmssd = Math.sqrt(sum_rr/rr_cnt);
        else
            rmssd = 0;

        rmssd *= 1000/SAMPLING_FREQ;
        this.setState({hrv:Math.floor(rmssd),indeterminate:true});
        rr = [];
        alert(rmssd);
        clearInterval(this._interval);
        CameraController.turnTorchOn(false);
        this.listener.remove();
        CameraController.stop();

    }

    start() {
        rr = [];
        this.listener = myModuleEvt.addListener('sayHello', (data) => this.update(data));
        CameraController.start();
        CameraController.turnTorchOn(true);
        this.setState({indeterminate:false,hrvProgress:0});
        setTimeout(() => this.calculateHRV(), 60000);
        this._interval = setInterval(() => this.updateProgress(), 3000);
    }
    updateProgress(){
        this.setState({hrvProgress:this.state.hrvProgress+0.05});
    }

    onComponentWillUnmount() {
        this.listener.remove();
        clearInterval(this._interval);
    }



    render() {
            return (

                    <View style={styles.mainContainer}>


                        <View style={{flex: 1, backgroundColor: 'skyblue'}}>
                          <ProgressBar
                            style={styles.progressCircle}
                            size= {100}
                            color= {"#FA8072"}
                            thickness= {10}
                            progress={this.state.hrvProgress}
                            indeterminate={this.state.indeterminate}
                          />                            
                        </View>

                        <View style={{flex: 2}}>
                            
                            <Text style={{fontSize: 20,fontWeight: 'bold'}} >{this.state.rgb}</Text>
                            <View  style={{flex: 1, backgroundColor: 'powderblue',flexDirection: 'column', justifyContent: 'center', alignItems: 'center'}}>

                                <Button
                                    containerStyle={{padding:10, height:45, overflow:'hidden', borderRadius:4, backgroundColor: 'red', justifyContent: 'center', alignItems: 'center'}}
                                    style = {{fontSize:20,color:'white', width:'70%'}}
                                    onPress={this.start.bind(this)}>
                                    Calculate HRV2
                                </Button>

                                <Text style={{fontSize: 40,fontWeight: 'bold', justifyContent: 'center'}} >{this.state.hrv}</Text>
                            </View>
                            

                            <View style={{flex: 4}}>
                                <VictoryChart theme={VictoryTheme.material}>

                                    <VictoryLine
                                        style={{ 
                                            parent: {border: "1px solid #ccc"},
                                            data: { stroke: "#c43a31", strokeWidth: 2 } 
                                        }}
                                        domain={{y: [this.state.int_avg-70, this.state.int_avg+70]}}
                                        data={chart}
                                        x="time"
                                        y="value" />

                                 <VictoryScatter
                                        style={{ data: { fill: "#c43a31" } }}
                                        size={7}
                                        domain={{y: [this.state.int_avg-70, this.state.int_avg+70]}}
                                        data={chart2}
                                        x="time"
                                        y="value"  />            


                                </VictoryChart>

                            </View>


                        </View>

                    </View>

            );
       }
    
}



const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: 'skyblue',
    },
    container: {
        flex: 5,
        flexDirection: 'row',
    },
    HRVButton: {
        width: '100%',
        height: '30%',
        justifyContent: 'center',
        alignItems: 'center'
    },
    progressCircle: {
        margin: 50
    },
    preview: {
        flex: 1,
        justifyContent: 'flex-end',
        alignItems: 'center'
    }
});






