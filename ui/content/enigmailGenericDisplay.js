// Initialize enigmailCommon
EnigInitCommon("enigmailGenericDisplay");

function enigLoadPage() {
  DEBUG_LOG("enigmailGenricDisplay: enigLoadPage\n");

  var contentFrame = EnigGetFrame(window, "contentFrame");
  if (!contentFrame)
    return;

  var placeholderElement = contentFrame.document.getElementById('placeholder');
  placeholderElement.appendChild(window.arguments[0]);

}

// window.onload = enigLoadPage;
