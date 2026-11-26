export function createControls() {
  const pressed = new Set();

  const inputState = {
    thrustForward: false,
    thrustBackward: false,
    turnLeft: false,
    turnRight: false
  };

  function updateInputState() {
    inputState.thrustForward = pressed.has('KeyW') || pressed.has('ArrowUp');
    inputState.thrustBackward = pressed.has('KeyS') || pressed.has('ArrowDown');
    inputState.turnLeft = pressed.has('KeyA') || pressed.has('ArrowLeft');
    inputState.turnRight = pressed.has('KeyD') || pressed.has('ArrowRight');
  }

  function onKeyDown(e) {
    if (
      e.code === 'ArrowUp' ||
      e.code === 'ArrowDown' ||
      e.code === 'ArrowLeft' ||
      e.code === 'ArrowRight'
    ) {
      e.preventDefault();
    }
    pressed.add(e.code);
    updateInputState();
  }

  function onKeyUp(e) {
    pressed.delete(e.code);
    updateInputState();
  }

  function onBlur() {
    pressed.clear();
    updateInputState();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return inputState;
}
