const robot = require("robotjs");

// Resolution of the
const screenSize = robot.getScreenSize();
const maxHeight = screenSize.height;
const maxWidth = screenSize.width;
let mousePos = robot.getMousePos();
let mouseBtnState = 0; //0==up, 1==down

// Move in the horizontal direction
const moveLeftRight = (pixels) => {
  if(mousePos.x <= maxWidth && mousePos.x >= 0){
    mousePos = robot.getMousePos();
    robot.moveMouse(mousePos.x + pixels, mousePos.y);
  }
};

// Move in the vertical direction
const moveUpDown = (pixels) => {
  if(mousePos.y <= maxHeight && mousePos.y >= 0){
    mousePos = robot.getMousePos();
    robot.moveMouse(mousePos.x, mousePos.y + pixels);
  }
};

// Move in the horizontal direction
const dragLeftRight = (pixels) => {
  if(mousePos.x <= maxWidth && mousePos.x >= 0){
    mousePos = robot.getMousePos();
    robot.dragMouse(mousePos.x + pixels, mousePos.y);
  }
};

// Move in the vertical direction
const dragUpDown = (pixels) => {
  if(mousePos.y <= maxHeight && mousePos.y >= 0){
    mousePos = robot.getMousePos();
    robot.dragMouse(mousePos.x, mousePos.y + pixels);
  }
};

//State can be either string "up" or "down"
const toggleBtnUpDwn = (state=null) => {
  if (state==null) {
    mouseBtnState ^= 1; //Toggle between down/up
    robot.mouseToggle(mouseBtnState==1 ? "down" : "up");
  }
  else {
    mouseBtnState = state=="up" ? 0 : 1; //Set to whatever state mouse is now in
    robot.mouseToggle(state);
  }
}

const scrollUpDown = (pixels) => {
  robot.scrollMouse(0,pixels);
}

const mouseLeftClick = () => {
  robot.mouseClick("left");
};

const mouseRightClick = () => {
  robot.mouseClick("right");
};

module.exports = { moveUpDown, moveLeftRight, 
                    dragUpDown, dragLeftRight, toggleBtnUpDwn,
                    scrollUpDown,
                    mouseLeftClick, mouseRightClick };