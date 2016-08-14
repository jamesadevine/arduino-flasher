chrome.app.runtime.onLaunched.addListener(function() {
    chrome.app.window.create('./arduino-flasher.html', {
        'outerBounds': {
            'width': 700,
            'height': 500
        },
        'resizable':false
    });
});
