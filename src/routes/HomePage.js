import React, { Component } from 'react';
import { AppRegistry, StyleSheet, Text, View, Image, NativeModules, NativeEventEmitter} from 'react-native';
import Svg,{Circle,Rect} from 'react-native-svg';
import { VictoryAxis, VictoryArea, VictoryBar, VictoryLine, VictoryScatter, VictoryChart, VictoryStack, VictoryTheme} from 'victory-native';
import Button from 'react-native-button'
import ProgressBar from 'react-native-progress/Circle'
import {Actions} from 'react-native-router-flux';
import io from 'socket.io-client';

//import TransactionVolumeGraph from './TransactionVolumeGraph';

//import PixelColor from 'react-native-pixel-color';

//import { Surface } from "gl-react-native";
//import Saturate from './Saturate';

// Sample period in seconds
const TEST_LENGTH = 60.0;
// Interval for progress bar updates, in seconds
const PROGRESS_BAR_INTERVAL = 3.0;

var signal = [];
// Full signal from start to finish
var full_signal = [];
var signal_ac = [];
var chart = [];
var chart2 = [];
var rr = [];
var prev = 0;
var cnt = 0;
var window_idx = 0;
// Counts the total number of frames collected during the test
var total_frames = 0;
const WINDOW_SIZE = 200;
// TODO(Tyler): This may be thirty if the device does not support 60 fps
// Tentatively 60 during the recording phase, updated to real value for
// calculation of HRV
var SAMPLING_FREQ = 60;


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
  }

    state = {
        width: null,
        height: null,
        isLoggedIn: false,
        path: 'https://facebook.github.io/react/img/logo_og.png',
        rgb: '...',
        hrv: '...',
        torchMode: null,
        signal_avg: 0,
        max_array: 100,
        indeterminate: true,
        hrvProgress: 0,
        int_avg : 50,
        frame_number : 0,
        sigma : 0  // Standard deviation of the signal in the current window
    }

    /**
     * Dictates when the UI should be redrawn. Returns true only after
     * frame_number has cycled back to zero. Used to control refresh rate.
     */
    shouldComponentUpdate(nextProps, nextState){
        return nextState.frame_number == 0;
    }

    update(data){
        // Log that another frame has been received
        total_frames++;
        this.setState({rgb:data});
        this.setState((state) => ({frame_number:((state.frame_number + 1) % 5)}));
        signal.shift();

        // Remove the first item in chart
        chart.shift();
        while(chart2.length >=1 ){
            if( chart2[0].time > 0 && chart2[0].time < chart[0].time){
                chart2.shift();
            }
            else
                break;
        }

        if(chart2.length == 0){
            chart2.push({time:chart[1].time,value:-10});
        }

        cnt += 1;
        window_idx += 1;
        var int_data = parseInt(data);

        var new_val = Math.abs(int_data - prev);
        prev = int_data;
        // New RMS alg:
        var rms = Math.pow(signal[WINDOW_SIZE-2][1]-signal[WINDOW_SIZE-3][1],2) + Math.pow(signal[WINDOW_SIZE-3][1]-signal[WINDOW_SIZE-4][1],2) + Math.pow(signal[WINDOW_SIZE-4][1]-signal[WINDOW_SIZE-5][1],2);
        rms = Math.sqrt(rms);
        rms /= 3;
        //--------


        chart.push({time: cnt, value: int_data});
        signal.push([cnt,int_data]);
        full_signal.push(int_data);
        this.state.signal_avg = this.state.signal_avg * 0.9 + parseInt(data) * 0.1;


        if(window_idx == WINDOW_SIZE - 140){
            window_idx = 0;

            // Calculate average and std dev
            // Must run before peakDetection as peakDetection relies on the avg
            this.calcWindowStats();

            this.peakDetection();
        }
    }

    /**
     * Calculates the average brightness and standard deviation for the
     * current window.
     */
    calcWindowStats(){
        var sum = 0;

        for (var i = 0; i < chart.length; i++) {
            sum += chart[i].value;
        }

        var averageBrightness = sum / chart.length;
        this.setState({int_avg : Math.floor(averageBrightness)});

        var sumOfSquaredDifferences = 0;

        for (var i = 0; i < chart.length; i++) {
            var currBrightness = chart[i].value;
            var difference = Math.abs(currBrightness - averageBrightness);
            sumOfSquaredDifferences += Math.pow(difference, 2);
        }

        var avgSquaredDifference = sumOfSquaredDifferences / chart.length;
        var standardDeviation = Math.sqrt(avgSquaredDifference);
        this.setState({sigma : Math.ceil(standardDeviation)});
    }

    /**
     * Finds peaks in the current window.
     */
    peakDetection(){
        const MAX_BPM = 150;
        const MAX_BPS = MAX_BPM / 60;
        // Min number of samples between peaks
        const MIN_INTERPEAK_DISTANCE = SAMPLING_FREQ / MAX_BPS;

        var up = false;
        var upcounter = 0;
        var downcounter = 0;
        var peak_idx = 0;
        var peak_val = 0;;
        var avg = 0;
        for(i=0; i<WINDOW_SIZE-1; i++){
            avg += chart[i].value;

            next_higher = chart[i + 1].value - chart[i].value >= 5;
            next_lower = !next_higher;
            if(up){
                if(next_higher){
                    console.log("Up:up, index: ",i," ,Value: ",chart[i].value ,"\n");

                    if(chart[i+1].value > peak_val){
                        peak_idx = i+1;
                        peak_val = chart[i+1].value;
                    }
                }
                else if(next_lower){
                    console.log("Up:Down, index: ",i," ,Value: ",chart[i].value ,"\n");
                    downcounter += 1;
                }
                if(downcounter >= 3){
                    upcounter = 0;
                    up = false;
                    console.log("Found Peak going down, index: ",i," ,Value: ",chart[i].value ,"\n");
                    // if(peak_val > this.state.int_avg){
                        // If this isn't the first peak
                        if(rr.length != 0){
                            // remove duplicates:
                            // alert(rr['l'].time);
                            if(chart[peak_idx].time <= rr[rr.length-1].time)
                                {
                                    peak_val = 0;
                                    continue;
                                }
                            // Ignore this peak if it is too close to the prev
                            if (Math.abs(chart[peak_idx].time - rr[rr.length - 1].time) < MIN_INTERPEAK_DISTANCE)
                                {
                                    peak_val = 0;
                                    continue;
                                }
                        }
                        rr.push({time:chart[peak_idx].time,value:chart[peak_idx].value});
                        chart2.push({time:chart[peak_idx].time,value:chart[peak_idx].value});
                        peak_val = 0;
                    // }
                }
            }
            else{
                if(next_higher){
                    console.log("Down:Up, index: ",i," ,Value: ",chart[i].value ,"\n");
                    upcounter +=1 ;
                }
                else if(next_lower){
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
        // Calculate the true SAMPLING_FREQ (Frames / second)
        SAMPLING_FREQ = total_frames / TEST_LENGTH;

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
        var removed_count = 0;
        for(i=1 ; i<rr.length-1 ; i++){
            // RR correction
            if(Math.abs(rr[i].time - rr[i-1].time) < rr_lower_thresh*avg_rr || Math.abs(rr[i+1].time - rr[i].time) < rr_lower_thresh*avg_rr || Math.abs(rr[i].time - rr[i-1].time) > rr_upper_thresh*avg_rr || Math.abs(rr[i+1].time - rr[i].time) > rr_upper_thresh*avg_rr)
                {
                    removed_count = removed_count + 1;
                    continue;
                }
            else {
                sum_rr += Math.pow((Math.abs(rr[i+1].time - rr[i].time)-Math.abs(rr[i].time - rr[i-1].time)),2);
                rr_cnt += 1;
            }
        }
        console.log("Had this many peaks: " + rr.length);
        console.log("really removed: " + removed_count);
        // alert("removed "+((rr.length-2)-rr_cnt)+" avg: "+(avg_rr * 1000/SAMPLING_FREQ));

        if(rr_cnt) {
            rmssd = Math.sqrt(sum_rr/rr_cnt);
            // alert('rmssd before multiplying: ' + rmssd);
        } else {
            alert('No rrs!');
            rmssd = 0;
        }

        rmssd *= 1000.0 / SAMPLING_FREQ;
        this.setState({hrv:'HRV: ' + Math.floor(rmssd),indeterminate:true});
        // Set frame_number to zero so that it will draw
        this.setState({frame_number: 0});
        rr = [];

        alert('Measurement complete!');

        console.log('Opening socket to server');
        const socket = io('http://er-lab.cs.ucla.edu/', { transports: ['websocket'] });

        socket.on('connect_error', (error) => {
            console.log('Error sending data to server' + error);
            alert('Error sending data to server' + error);
        });

        socket.send({type: 'hrv',
                   firstname: this.props.firstname,
                   lastname: this.props.lastname,
                   team: this.props.team,
                   timestamp: Math.round(Date.now() / 1000),  // We want time in seconds
                   data: {hrv: rmssd, pleth: full_signal}});

        clearInterval(this._interval);
        CameraController.turnTorchOn(false);
        this.listener.remove();
        CameraController.stop();

    }

    // TODO(Tyler): Modify this method so that the button  will stop
    // and then restart a test.
    /**
     * Starts the test running once the button is pressed.
     */
    start() {
        rr = [];
        this.listener = myModuleEvt.addListener('sayHello', (data) => this.update(data));
        CameraController.start();
        CameraController.turnTorchOn(true);
        this.setState({indeterminate:false,hrvProgress:0, hrv: 'HRV: calculating'});
        setTimeout(() => this.calculateHRV(), 1000 * TEST_LENGTH);
        this._interval = setInterval(() => this.updateProgress(), PROGRESS_BAR_INTERVAL * 1000);
    }

    updateProgress(){
        // There are TEST_LENGTH / PROGRESS_BAR_INTERVAL ticks
        // After all ticks are complete, bar must be completely progressed
        this.setState({hrvProgress: this.state.hrvProgress
                        + (1.0 / (TEST_LENGTH / PROGRESS_BAR_INTERVAL))});
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
                                        domain={{y: [this.state.int_avg - 3 * this.state.sigma, this.state.int_avg + 3 * this.state.sigma], x: [chart[0].time, chart[WINDOW_SIZE-1].time]}}
                                        data={chart}
                                        x="time"
                                        y="value" />

                                 <VictoryScatter
                                        style={{ data: { fill: "#c43a31" } }}
                                        size={7}
                                        domain={{y: [this.state.int_avg - 3 * this.state.sigma, this.state.int_avg + 3 * this.state.sigma], x: [chart[0].time, chart[WINDOW_SIZE-1].time]}}
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
