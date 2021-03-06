// Gets the video tag (id: _webcam) from index.html
let webcam = document.getElementById("_webcam");

let startCamera, stopCamera, onStreamDimensionsAvailable;

/**
 * Starts the webcam camera
 */
startCamera = () => {
    console.log("started");

    // When the media stream is received, set the webcam element to the stream
    let onMediaStream = (mediaStream) => {
        webcam.srcObject = mediaStream;
        webcam.play();
    };

    window.navigator.mediaDevices.getUserMedia({
        video: {
            width: 320,
            height: 240,
            frameRate: 30,
        }
    })
        .then(onMediaStream)
        .catch(() => {
            alert("No camera available")
        });
};

stopCamera = () => {
    //webcam.pause();
};

onStreamDimensionsAvailable = (callback) => {
    if (webcam.videoWidth === 0) {
        setTimeout(function () {
            onStreamDimensionsAvailable(callback)
        }, 100);
    } else {
        callback();
    }
};

module.exports = {startCamera, stopCamera, onStreamDimensionsAvailable};
