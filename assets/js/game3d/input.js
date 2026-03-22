export const input = {
  forward:  false,
  back:     false,
  left:     false,
  right:    false,
  running:  false,
  interact: false,
  cameraYaw: 0, // set externally from camera
  actionSlot: 0, // 1-9 when pressed, 0 = none
};

let interactConsumed = false;

window.addEventListener('keydown', e => {
  switch (e.key.toLowerCase()) {
    case 'w': case 'arrowup':    input.forward  = true; break;
    case 's': case 'arrowdown':  input.back     = true; break;
    case 'a': case 'arrowleft':  input.left     = true; break;
    case 'd': case 'arrowright': input.right    = true; break;
    case 'shift':                input.running  = true; break;
    case 'e':
      if (!interactConsumed) { input.interact = true; interactConsumed = true; }
      break;
    case '1': case '2': case '3': case '4': case '5':
    case '6': case '7': case '8': case '9':
      input.actionSlot = parseInt(e.key, 10);
      break;
  }
  // Block scroll keys
  if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) {
    e.preventDefault();
  }
});

window.addEventListener('keyup', e => {
  switch (e.key.toLowerCase()) {
    case 'w': case 'arrowup':    input.forward = false; break;
    case 's': case 'arrowdown':  input.back    = false; break;
    case 'a': case 'arrowleft':  input.left    = false; break;
    case 'd': case 'arrowright': input.right   = false; break;
    case 'shift':                input.running = false; break;
    case 'e':
      input.interact   = false;
      interactConsumed = false;
      break;
  }
});
