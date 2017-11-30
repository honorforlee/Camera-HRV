import React, { Component } from 'react';
import { AppRegistry, StyleSheet, Text, View, Image, NativeModules, NativeEventEmitter} from 'react-native';
import Svg,{Circle,Rect} from 'react-native-svg';
import { VictoryAxis, VictoryArea, VictoryBar, VictoryLine, VictoryScatter, VictoryChart, VictoryStack, VictoryTheme} from 'victory-native';
import Button from 'react-native-button'
import ProgressBar from 'react-native-progress/Circle'
import {Actions} from 'react-native-router-flux';
import io from 'socket.io-client';

// Sample period in seconds
const TEST_LENGTH = 60.0;
// Interval for progress bar updates, in seconds
const PROGRESS_BAR_INTERVAL = 1.0;
// Run peak after this many samples
const PEAK_DETECTION_INTERVAL = 60;

// Whether to show raw data or to show idealized data
const IDEALIZED_VISUALS = true;
// Signal that is currently displayed
var displayed_signal = [];
// Peaks that are being displayed
var displayed_peaks = [];
// Signal that is about to be displayed
var holding_signal = [];

const PERFECT_PEAK = [0.0, 0.00295858, 0.00887574, 0.014792899, 0.023668639,
    0.029585799, 0.047337278, 0.088757396, 0.118343195, 0.210059172,
    0.417159763, 0.689349112, 0.914201183, 0.99704142, 0.940828402,
    0.789940828, 0.615384615, 0.461538462, 0.346153846, 0.266272189,
    0.233727811, 0.24852071, 0.289940828, 0.322485207, 0.325443787,
    0.286982249, 0.224852071, 0.153846154, 0.085798817, 0.038461538,
    0.01183432, 0.0];

// Full signal from start to finish
var full_signal = [];
var chart = [];
var upper_y_limit = 0;
var lower_y_limit = 0;
var chart2 = [];
var rr = [];
// The 'x' value of next frame. This frame is the cnt'th frame received.
var cnt = 0;
var window_idx = 0;

// Counts the total number of frames collected during the test
var total_frames = 0;
const WINDOW_SIZE = 200;

// TODO(Tyler): This may be thirty if the device does not support 60 fps
// Tentatively 60 during the recording phase, updated to real value for
// calculation of HRV
var SAMPLING_FREQ = 60;

for(i = 0; i < WINDOW_SIZE; i++){
    chart.push({time: i, value: 0});
    displayed_signal.push({time: -2 * WINDOW_SIZE + i, value: 0});
    holding_signal.push({time: -WINDOW_SIZE + i, value: 0});
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
        hrv: '...',
        torchMode: null,
        indeterminate: true,
        hrvProgress: 0,
        draw_ctr : 0 // UI draws when draw_ctr equals zero
    }

    /**
     * Dictates when the UI should be redrawn. Returns true only after
     * draw_ctr has cycled back to zero. Used to control refresh rate.
     */
    shouldComponentUpdate(nextProps, nextState){
        return nextState.draw_ctr == 0;
    }

    update(data){
        // Log that another frame has been received
        total_frames++;
        this.setState({rgb:data});
        this.setState((state) => ({draw_ctr: ((state.draw_ctr + 1) % 5)}));

        var int_data = parseInt(data);

        // Record this bit of the signal
        full_signal.push(int_data);

        cnt += 1;
        window_idx += 1;

        // Code to display the actual signal
        if (!IDEALIZED_VISUALS) {
            // Remove the first item in chart
            chart.shift();
            // Remove peaks from the scatter plot that are no longer visible
            while (chart2.length >= 1 ){
                if(chart2[0].time > 0 && chart2[0].time < chart[0].time){
                    chart2.shift();
                }
                else {
                    break;
                }
            }

            if(chart2.length == 0){
                chart2.push({time:chart[1].time,value:-10});
            }

            chart.push({time: cnt, value: int_data});

            displayed_signal = chart;
            displayed_peaks = chart2;
        } else {
            // Display the idealized signal

            // here we pop a data point from the holding signal and append
            // to the display signal.

            chart.shift();
            chart.push({time: cnt, value: int_data});

            displayed_signal.shift();
            var new_point = holding_signal.shift();
            displayed_signal.push(new_point);


            // add a new point onto the back of the holding signal

            // Remove displayed peaks that are no longer visible
            var leftmost_edge = displayed_signal[0].time;
            while(displayed_peaks.length >= 1 ) {
                var earliest_peak = displayed_peaks[0].time;
                if (earliest_peak > 0 && earliest_peak < leftmost_edge) {
                    displayed_peaks.shift();
                }
                else {
                    break;
                }
            }

            // append peaks from chart2 onto the displaed peaks only when
            // they become visible
            if (chart2.length >= 1) {
                var latest_time = displayed_signal[WINDOW_SIZE - 1].time;
                var earliest_waiting_peak = chart2[0].time;
                if (earliest_waiting_peak <= latest_time) {
                    displayed_peaks.push(chart2.shift());
                }
            }

            // Add new entry to holding signal only if it is not already
            // at its ideal length
            if (holding_signal.length < WINDOW_SIZE) {
                // add window size to account for the part thats already filled
                holding_signal.push({time: cnt, value: 0});
            }
        }

        if (window_idx == PEAK_DETECTION_INTERVAL) {
            window_idx = 0;

            // Calculate upper and lower limits for graph y axis
            this.calcWindowStats();

            // Detect peaks
            this.peakDetection();
        }
    }

    /**
     * Calculates the average brightness and standard deviation for the
     * current window. Uses this to set the viewing window
     */
    calcWindowStats(){
        if (!IDEALIZED_VISUALS) {
            // Set range based on standard deviation
            var sum = 0;

            for (var i = 0; i < chart.length; i++) {
                sum += chart[i].value;
            }

            var averageBrightness = sum / chart.length;
            var int_avg = Math.floor(averageBrightness);

            var sumOfSquaredDifferences = 0;

            for (var i = 0; i < chart.length; i++) {
                var currBrightness = chart[i].value;
                var difference = Math.abs(currBrightness - averageBrightness);
                sumOfSquaredDifferences += Math.pow(difference, 2);
            }

            var avgSquaredDifference = sumOfSquaredDifferences / chart.length;
            var standardDeviation = Math.sqrt(avgSquaredDifference);
            var sigma = Math.ceil(standardDeviation);

            upper_y_limit = int_avg + 3 * sigma;
            lower_y_limit = int_avg - 3 * sigma;
        } else {
            // If showing the idealized signal, the lower peak should be zero
            // max should be a bit over the peak's value
            var max = -1;
            for (var i = 0; i < chart.length; i++) {
                if (chart[i].value > max) {
                    max = chart[i].value;
                }
            }
            upper_y_limit = 1.1 * max;
            lower_y_limit = 0;
        }
    }

    /**
     * Finds peaks in the current window.
     */
    peakDetection(){
        const MAX_BPM = 150;
        const MAX_BPS = MAX_BPM / 60;
        // Min number of samples between peaks
        // const MIN_INTERPEAK_DISTANCE = SAMPLING_FREQ / MAX_BPS;

        const MIN_INTERPEAK_DISTANCE = PERFECT_PEAK.length;

        // Initialize values for state machine
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
            if (up) {
                if (next_higher) {
                    console.log("Up:up, index: ",i," ,Value: ",chart[i].value ,"\n");

                    if (chart[i+1].value > peak_val){
                        peak_idx = i+1;
                        peak_val = chart[i+1].value;
                    }
                }
                else if (next_lower) {
                    console.log("Up:Down, index: ",i," ,Value: ",chart[i].value ,"\n");
                    downcounter += 1;
                }
                if (downcounter >= 3) {
                    upcounter = 0;
                    up = false;
                    console.log("Found Peak going down, index: ",i," ,Value: ",chart[i].value ,"\n");

                    // If this isn't the first peak
                    if (rr.length != 0) {
                        // remove duplicates:
                        // alert(rr['l'].time);
                        if (chart[peak_idx].time <= rr[rr.length-1].time) {
                            peak_val = 0;
                            continue;
                        }
                        // Ignore this peak if it is too close to the prev
                        var latest_peak_time = rr[rr.length - 1].time;
                        var peak_time = chart[peak_idx].time;
                        var interpeak_distance = Math.abs(peak_time
                            - latest_peak_time);

                        if (interpeak_distance < MIN_INTERPEAK_DISTANCE) {
                            peak_val = 0;
                            continue;
                        }
                    }
                    // Record the location of the peak for processing
                    rr.push({time:chart[peak_idx].time,
                             value:chart[peak_idx].value});

                    if (IDEALIZED_VISUALS) {
                        var peak_value = chart[peak_idx].value;
                        // Must add window_size in order to account for the delay
                        chart2.push({time: chart[peak_idx].time + 14,
                                     value: peak_value});
                        // Now add the idealized peak into the holding signal


                        // Find where to insert the idealized signal in the
                        // holding area
                        var found_match = false;
                        var target_time = chart[peak_idx].time;
                        for (i = 0; i < WINDOW_SIZE; i++) {
                            if (holding_signal[i].time == target_time) {
                                found_match = true;
                                break;
                            }
                        }


                        // i is now the index where the matching value resides
                        var idealized_peak_index = 0;

                        while (i < WINDOW_SIZE &&
                                idealized_peak_index< PERFECT_PEAK.length) {
                            // insert the idealized peak into the signal
                            holding_signal[i] = {time: holding_signal[i].time,
                                value: PERFECT_PEAK[idealized_peak_index]
                                        * peak_val};
                            idealized_peak_index++;
                            i++;
                        }

                        // if full signal hasn't yet been added due to
                        // peak overlapping end of window
                        var time_val = chart[peak_idx].time;
                        while (idealized_peak_index < PERFECT_PEAK.length) {
                            var push_val = PERFECT_PEAK[idealized_peak_index]
                                            * peak_val;

                            holding_signal.push(
                                {time: time_val + idealized_peak_index,
                                 value: push_val});
                            idealized_peak_index++;
                        }
                    } else {
                        chart2.push({time:chart[peak_idx].time,
                                     value:chart[peak_idx].value});
                    }
                    peak_val = 0;
                }
            }
            else{
                if (next_higher) {
                    console.log("Down:Up, index: ",i," ,Value: ",chart[i].value ,"\n");
                    upcounter +=1 ;
                }
                else if (next_lower) {
                    console.log("Down:Down, index: ",i," ,Value: ",chart[i].value ,"\n");
                    upcounter -= 0;
                }
                if (upcounter >= 2) {
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

        this.setState({ width, height });

    }

    calculateHRV(){
        // Calculate the true SAMPLING_FREQ (Frames / second)
        SAMPLING_FREQ = total_frames / TEST_LENGTH;

        sum_rr = 0;
        rmssd = 0;
        rr_cnt = 0;

        avg_rr = 0;
        for (i = 1; i < rr.length - 1 ;i++) {
            avg_rr += Math.abs(rr[i+1].time - rr[i].time);
        }
        avg_rr /= rr.length - 1;

        var rr_lower_thresh = 0.7;
        var rr_upper_thresh = 1.3;
        var removed_count = 0;
        for(i=1; i < rr.length - 1; i++){
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
        // Set draw_ctr to zero so that UI will draw
        this.setState({draw_ctr: 0});
        rr = [];

        alert('Measurement complete!');

        console.log('Opening socket to server');
        const socket = io('http://er-lab.cs.ucla.edu:443',
                          { transports: ['websocket'] });

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


                        <View style={{flex: .75, backgroundColor: 'skyblue'}}>
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
                                        domain={{y: [lower_y_limit, upper_y_limit], x: [displayed_signal[0].time, displayed_signal[WINDOW_SIZE-1].time]}}
                                        data={displayed_signal}
                                        x="time"
                                        y="value" />

                                    <VictoryScatter
                                        style={{ data: { fill: "#c43a31" } }}
                                        size={7}
                                        domain={{y: [lower_y_limit, upper_y_limit], x: [displayed_signal[0].time, displayed_signal[WINDOW_SIZE-1].time]}}
                                        data={displayed_peaks}
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
