//===============================================================================

function onLogin() {
	var tokenInput = document.getElementById('token');
	var signInput = document.getElementById('signature');
	var loginForm = document.getElementById('loginForm');

	showDimmer('Reading private key...');
	
	readPrivateKey()
	.then(function(result) {
		if (result) {
			console.log("EndUser: private key readed " + result.subjCN + ".");
		}

		showDimmer('Signing data...');
		
		return g_euSign.SignData(tokenInput.value, true);
	})
	.then(function(sign) {
		showDimmer('Sending data...');
		
		console.log("EndUser: data signed");
		console.log("Data: " + tokenInput.value);
		console.log("Sign: " + sign);

		signInput.value = sign;

		loginForm.submit();
	})
	.catch(function(e) {
		hideDimmer();
				
		var msg = (e.message || e);
		
		console.log("Sign data error: " + msg);

		alert('An error occurred while signing the data. ' + 
			'Error description: ' + msg);
	});
}

//===============================================================================

window.addEventListener("load", function (event) {
	document.getElementById('backButton').addEventListener(
		'click', function() {
			document.getElementById('loginBlock').style.display = 'block';
			document.getElementById('pkBlock').style.display = 'none';
			document.getElementById('backButton').style.display = 'none';
		}, false);

	document.getElementById('nextButton').addEventListener(
		'click', function() {
			if (document.getElementById('loginBlock').style.display == 'none') {
				onLogin();
			} else {
				if (document.getElementById('username').value == '') {
					alert('Please, enter login');
					return;
				}
				
				if (document.getElementById('password').value == '') {
					alert('Please, enter password');
					return;
				}
				
				document.getElementById('loginBlock').style.display = 'none';
				document.getElementById('pkBlock').style.display = 'block';
				document.getElementById('backButton').style.display = '';			
			}
		}, false);
});

//===============================================================================