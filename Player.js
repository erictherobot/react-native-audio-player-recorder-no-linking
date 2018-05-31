import React, { Component } from 'react';
import { StyleSheet, Text, View, Dimensions, ScrollView } from 'react-native';
import { Audio } from 'expo';
import PropTypes from 'prop-types';
import * as defaultProps from './defaults';
import renderIf from 'render-if';
import PlaybackSlider from './PlaybackSlider';
import TimeStamp from './TimeStamp';
export default class Player extends Component {
  constructor(props) {
    super(props);
    const { width } = Dimensions.get('window');
    this.progressBarWidth = width * 0.9;
    this.sound = null;
    this.state = {
      isLoaded: false,
      isBuffering: 'NOT_STARTED',
      playStatus: 'LOADING', // LOADING, BUFFERING, PAUSED, STOPPED, PLAYING
      blinkTimeStamp: true,

      // legacy items
      isPlaying: false,
      durationMillis: 0,
      playbackMillis: 0,
      maxSliderValue: 0,
      currentSliderValue: 0,
      debugStatements: 'debug info will appear here'
    };
  }

  componentDidMount = () => {
    this.mounted = true;
    this.loadSound();
  };

  componentWillUnmount = () => {
    this.setState({
      isLoaded: false,
      isBuffering: 'NOT_STARTED'
    });
    this.sound.setOnPlaybackStatusUpdate(null);
    this.mounted = false;
  };

  renderPlayButtonByStatus = () => {
    let button;
    if (
      this.state.playStatus === 'BUFFERING' ||
      this.state.playStatus === 'LOADING'
    ) {
      button = this.props.loadingButton;
    } else if (
      this.state.playStatus === 'PAUSED' ||
      this.state.playStatus === 'STOPPED'
    ) {
      button = this.props.playButton;
    } else if (this.state.playStatus === 'PLAYING') {
      button = this.props.playingButton;
    } else if (this.state.playStatus === 'ERROR') {
      button = this.props.errorBadge;
    } else {
      debugger;
    }

    return <View style={{ backgroundColor: 'grey' }}>{button}</View>;
  };

  loadSound = async () => {
    let sound = new Audio.Sound();
    try {
      sound.setOnPlaybackStatusUpdate(this.onPlaybackStatusUpdate);
      let soundInfo = await sound.loadAsync({ uri: this.props.uri });
      this.setState({
        maxSliderValue: soundInfo.durationMillis,
        durationMillis: soundInfo.durationMillis,
        positionMillis: soundInfo.positionMillis,
        currentSliderValue: soundInfo.positionMillis,
        shouldPlay: soundInfo.shouldPlay,
        isPlaying: soundInfo.isPlaying,
        rate: soundInfo.rate,
        muted: soundInfo.isMuted,
        volume: soundInfo.volume,
        shouldCorrectPitch: soundInfo.shouldCorrectPitch,
        isPlaybackAllowed: true
      });
      this.sound = sound;
    } catch (error) {
      // An error occurred!
      console.warn(error);
      //debugger;
    }
  };

  addDebugStatement = (statement) => {
    this.setState({
      debugStatements: this.state.debugStatements.concat(`- ${statement}\n`)
    });
  };

  /*
  Function used to update the UI during playback
  Playback Status Order:
  1. isLoaded: false
  2. isLoaded: true, isBuffering: true, duration 1st available
  3. isloaded: true, isBuffering: false
  */
  onPlaybackStatusUpdate = (playbackStatus) => {
    if (this.mounted) {
      let that = this;
      this.setState({
        prevPlaybackStatus: that.state.playbackStatus,
        playbackStatus: playbackStatus
      });

      if (playbackStatus.error) {
        this.setState({ playBackStatus: 'ERROR' });
        this.addDebugStatement(
          `Encountered a fatal error during playback: ${playbackStatus.error}
        Please report this error as an issue.  Thank you!`
        );
      }

      if (playbackStatus.isLoaded) {
        // don't care about buffering if state.playStatus is equal to one of the other states
        // state.playStatus can only be equal to one of the other states after buffer
        // has completed, at which point state.playStatus is set to 'STOPPED'
        if (
          this.state.playStatus !== 'PLAYING' &&
          this.state.playStatus !== 'PAUSED' &&
          this.state.playStatus !== 'STOPPED' &&
          this.state.playStatus !== 'ERROR'
        ) {
          if (playbackStatus.isLoaded && !this.state.isLoaded) {
            this.setState({ isLoaded: true });
            this.addDebugStatement(`playbackStatus.isLoaded`);
          }
          if (this.state.isLoaded && playbackStatus.isBuffering) {
            this.setState({
              playStatus: 'BUFFERING'
            });
            this.addDebugStatement(`playbackStatus.isBuffering IN_PROGRESS`);
          }
          if (
            this.state.isLoaded &&
            !playbackStatus.isBuffering &&
            playbackStatus.hasOwnProperty('durationMillis')
          ) {
            this.setState({
              playStatus: 'STOPPED'
            });
            this.addDebugStatement(`playbackStatus.isBuffering COMPLETE`);
          }
        }

        // Update the UI for the loaded state
        if (playbackStatus.isPlaying) {
          this.addDebugStatement(
            `playbackStatus.positionMillis (here): ${
              playbackStatus.positionMillis
            }`
          );

          // Update  UI for the playing state
          this.setState({
            positionMillis: playbackStatus.positionMillis,
            currentSliderValue: playbackStatus.positionMillis
          });
        }

        if (playbackStatus.didJustFinish && !playbackStatus.isLooping) {
          this.addDebugStatement('playbackStatus is stopped');
          this.setState({
            playStatus: 'STOPPED',
            isPlaying: false,
            positionMillis: playbackStatus.durationMillis,
            currentSliderValue: playbackStatus.durationMillis
          });
        }
      }
    }
  };

  onSliderValueChange = (value) => {
    // set the postion of the actual sound object
    this.addDebugStatement(`onSliderValueChange: ${value}`);
    this.sound.setPositionAsync(value);
  };

  onPausePress = () => {
    if (this.sound != null) {
      this.sound.pauseAsync().then(() => {
        this.setState({ playStatus: 'PAUSED' });
      });
    }
  };

  onPlayPress = () => {
    if (this.sound != null  && this.mounted) {
      if (this.state.positionMillis === this.state.durationMillis) {
        this.sound.stopAsync().then(() => {
          this.sound.playAsync().then(() => {
            debugger;
            this.setState({ playStatus: 'PLAYING' });
          });
        });
      } else {
        // just play from wherever we are
        this.sound
          .playAsync()
          .then(() => {
            this.setState({ playStatus: 'PLAYING' });
          })
          .catch((err) => {
            console.warn(err);
            debugger;
          });
      }
    }
  };

  stopPlaying = () => {
    this.sound.stopAsync();
  };

  render() {
    return (
      <View style={styles.container}>
        {this.renderPlayButtonByStatus()}
        <View style={{ backgroundColor: 'orange', flex: 1 }}>
          <PlaybackSlider
            maximumValue={this.state.maxSliderValue}
            value={this.state.currentSliderValue}
            onSlidingComplete={this.onSliderValueChange.bind(this)}
            sliderWidth={this.progressBarWidth}
          />
        </View>

        {/* {this.props.showTimeStamp ? (
          <View style={{backgroundColor: 'red', flex: 1}}>
            <TimeStamp
              blink={this.state.blinkTimeStamp}
              timeStampStyle={this.props.timeStampStyle}
              positionMillis={this.state.positionMillis}
              durationMillis={this.state.durationMillis}
            />
          </View>
        ) : null} */}

        <View style={{ alignSelf: 'stretch' }}>
          {this.props.goBackButton}

          {renderIf(this.props.showDebug)(
            <ScrollView
              style={{
                backgroundColor: '#FAFAD2',
                height: 150,
                padding: 5,
                borderWidth: 0.5,
                borderColor: '#d6d7da'
              }}
            >
              <Text style={{ color: 'darkblue' }}>
                {this.state.debugStatements}
              </Text>
            </ScrollView>
          )}
        </View>
      </View>
    );
  }
}

Player.propTypes = {
  timeStampStyle: PropTypes.object,
  showTimeStamp: PropTypes.bool,
  showDebug: PropTypes.bool
};

Player.defaultProps = {
  timeStampStyle: defaultProps.timeStampStyle,
  showTimeStamp: true,
  showDebug: false
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'goldenrod'
  }
});
