let draw = require("./draw");
let mouse = require("../peripheral/mouse");
let blink = require("./blink");
let mouth = require("./mouth");
let preferences = require("../../preferences/preferences");

//Used in point tracking
let pointsToAdd = [];       //Used in tracking after face is lost
let lostFacePoints = [];    //Used in tracking after face is lost
let firstLoopNoFace = true; //Used in tracking after face is lost
let lastXYs = [];           //For tracking face move offsets
let prevWholeFace = [];     //Used to detect blinks/facial changes

let userClicked = false; //Used to change line color

//Camera/Library letiables
let webcam;
let imageData;
let brfManager;
let resolution;
let brfv4;

function startTrackFaces(_webcam, _imageData, _brfManager, _resolution, _brfv4) {
  webcam = _webcam;
  imageData = _imageData;
  brfManager = _brfManager;
  resolution = _resolution;
  brfv4 = _brfv4;
  trackFaces();
}

function trackFaces() {
  //Add manual points to be tracked
  if (pointsToAdd.length > 0) {
    brfManager.reset();
    brfManager.addOpticalFlowPoints(pointsToAdd);
    pointsToAdd = [];
  }

  let imageDataCtx = imageData.getContext("2d");
  imageDataCtx.setTransform(-1.0, 0, 0, 1, resolution.width, 0); // mirrored for draw of video
  imageDataCtx.drawImage(webcam, 0, 0, resolution.width, resolution.height);
  imageDataCtx.setTransform(1.0, 0, 0, 1, 0, 0); // unmirrored for draw of results
  brfManager.update(imageDataCtx.getImageData(0, 0, resolution.width, resolution.height).data);

  let faces = brfManager.getFaces();
  let faceFound = false;
  for (let i = 0; i < faces.length; i++) {
    let face = faces[i];
    if (face.state === brfv4.BRFState.FACE_TRACKING_START ||
      face.state === brfv4.BRFState.FACE_TRACKING) {
      faceFound = true;

      //Check offsets
      let newXYs = [];
      newXYs.push([face.vertices[60], face.vertices[61]]); //Tip of nose
      newXYs.push([face.vertices[66], face.vertices[67]]); //Middle base of nose
      newXYs.push([face.vertices[78], face.vertices[79]]); //Inside of users right eye (eye on left of screen)
      newXYs.push([face.vertices[84], face.vertices[85]]); //Inside of users left eye (eye on right of screen)

      //Update lost face!
      lostFacePoints = newXYs;

      //If first time in here after no face was found, clear old array of lastXYs
      if (!firstLoopNoFace) {
        lastXYs = [];
      }
      firstLoopNoFace = true;

      userClicked = false;
      //Check for clicks!
      if (preferences.getLeftClick() == "mouth" || preferences.getRightClick() == "mouth") {
        mouthRet = mouth.mouthOpened(face.vertices);
        userClicked = mouthRet.waitingForTimeout;
        if (mouthRet.mouth) {
          if (preferences.getLeftClick() == "mouth") {
            //Left click
            //If in drag mode, mouth will toggle mouse down/up.
            // else, mouth will left click mouse.
            if (preferences.getMode() == "drag")
              mouse.toggleBtnUpDwn();
            else
              mouse.mouseLeftClick();
          }
          else {
            //Right click
            mouse.mouseRightClick();
          }
        }
      }
      if ((preferences.getLeftClick()+preferences.getRightClick()).includes("blink")) {
        //Click if user has blinked
        if (prevWholeFace != []) {
          blinkRet = blink.blinked(prevWholeFace, face.vertices,
            preferences.getLeftClick().includes("blink"),
            preferences.getRightClick().includes("blink"));
          if (blinkRet.left && blinkRet.right) {
            //Maybe do something when both eyes blink? (Probably not)
          }
          else {
            if (preferences.getLeftClick() == "left-blink") {
              userClicked = blinkRet.waitingForTimeout || userClicked;
              if (blinkRet.left) {
                //If in drag mode, left blink will toggle mouse down/up.
                // else, left blink will left click mouse.
                if (preferences.getMode() == "drag")
                  mouse.toggleBtnUpDwn();
                else
                  mouse.mouseLeftClick();
              }
            }
            if (preferences.getRightClick() == "right-blink") {
              userClicked = blinkRet.waitingForTimeout || userClicked;
              if (blinkRet.right) 
                mouse.mouseRightClick();
            }
          }
        }
      }

      prevWholeFace = face.vertices.slice(); //Copys by value instead of by reference

      //Move the mouse!
      moveMouse(lastXYs, newXYs);

      //Set last face coords to current face coords
      lastXYs = newXYs;

      //Set stroke color based on whether or not user was blinking
      // yellow = blink, blue = normal (no blink)
      imageDataCtx.strokeStyle = userClicked ? "#e6e600" /*yellow*/: "#00a0ff"; /*blue*/

      //Draw dots
      for (let k = 0; k < face.vertices.length; k += 2) {
        draw.drawPoint(imageDataCtx, face.vertices[k], face.vertices[k + 1], 2);
      }
      //Draw triangles connecting dots
      if (face.triangles.length >= 3) {
        for (let k = 0; k < face.triangles.length; k += 3) {
          let indices = [face.triangles[k], face.triangles[k + 1], face.triangles[k + 2]];
          let pts = [ {x:face.vertices[indices[0]*2], y:face.vertices[indices[0]*2 + 1]},
            {x:face.vertices[indices[1]*2], y:face.vertices[indices[1]*2 + 1]},
            {x:face.vertices[indices[2]*2], y:face.vertices[indices[2]*2 + 1]} ];
          draw.drawTriangle(imageDataCtx, pts);
        }
      }
    }
  }

  //If no faces were found, draw rectangles where brfv4 is trying to locate faces
  //Also, begin tracking lostFacePoints until a face is found again
  if (!faceFound) {
    //Get points being tracked
    let opticalPoints = brfManager.getOpticalFlowPoints();
    let states = brfManager.getOpticalFlowPointStates();

    // Draw points by state: green valid, red invalid
    for (i = 0; i < opticalPoints.length; i++) {
      if (states[i]) { //Valid
        imageDataCtx.strokeStyle = "#00ff00";
        draw.drawPoint(imageDataCtx, opticalPoints[i].x, opticalPoints[i].y, 3)
      } else { //Invalid (Should never happen because setOpticalFlowCheckPointsValidBeforeTracking is set to true)
        imageDataCtx.strokeStyle = "#ff0000";
        draw.drawPoint(imageDataCtx, opticalPoints[i].x, opticalPoints[i].y, 3)
      }
    }

    //Move mouse based on lostFacePoints movement

    //If this is the first time in this code block after brfv4 failed to find a face:
    if (firstLoopNoFace) {
      for (let i = 0; i < lostFacePoints.length; i++) {
        let pt = lostFacePoints[i];
        pointsToAdd.push(new brfv4.Point(pt[0], pt[1]));
      }
      firstLoopNoFace = false;
    }
    //If this code has already been run:
    else {
      lostFacePoints = [];
      for (let i = 0; i < opticalPoints.length; i++) {
        let pt = opticalPoints[i];
        lostFacePoints.push([pt.x, pt.y]);
      }
      moveMouse(lastXYs, lostFacePoints)
      lastXYs = lostFacePoints;
    }

    //Rectangles
    let rectangles = brfManager.getAllDetectedFaces();
    for (let i = 0; i < rectangles.length; i++) {
      rect = rectangles[i];
      draw.drawSquare(imageDataCtx, rect);
    }
    rectangles = brfManager.getMergedDetectedFaces();
    for (let i = 0; i < rectangles.length; i++) {
      rect = rectangles[i];
      draw.drawSquare(imageDataCtx, rect);
    }
  }

  //Update
  requestAnimationFrame(trackFaces);
}

function moveMouse(xy1/*Prev*/, xy2/*New*/) {
  if (xy1.length > 0) {
    let xTotal = 0;
    let yTotal = 0;
    for (let j = 0; j < xy2.length; j++) {
      xTotal += xy2[j][0] - xy1[j][0];
      yTotal += xy2[j][1] - xy1[j][1];
    }
    xTotal /= xy2.length;
    yTotal /= xy2.length;

    let factor = 10;
    
    //Perform action based on current mode:
    if (preferences.getMode() == "mouse") {
      mouse.moveLeftRight(xTotal*factor);
      mouse.moveUpDown(yTotal*factor);
    }
    else if (preferences.getMode() == "drag") {
      mouse.dragLeftRight(xTotal*factor);
      mouse.dragUpDown(yTotal*factor);
    }
    else if (preferences.getMode() == "scroll") {
      if (xy2.length < 1)
        return;
      factor = 225;
      pt = xy2[0]; //Only care about middle nose point
      mid = resolution.height/2;
      midSect = 1/8;
      midSectTop = mid - (midSect*resolution.height*0.5);
      midSectBtm = mid + (midSect*resolution.height*0.5);

      //Scroll up or down at a rate that is based on how far away from 
      // the middle of the screen the users nose is.
      //*If nose is in the middle 1/8th of the screen, no scrolling.
      if (pt[1] > midSectBtm) {
        let percent = (pt[1]-midSectBtm)/(resolution.height - midSectBtm);
        mouse.scrollUpDown(-factor*percent);
      }
      else if (pt[1] < midSectTop) {
        let percent = -(pt[1]-midSectTop)/(midSectTop);
        mouse.scrollUpDown(factor*percent);
      }
    }
  }
}

module.exports = { startTrackFaces };
