//===============================================================================

var documentsToSign = null;

//===============================================================================

function onReadPKey() {
	var pkSelectBlock = document.getElementById('pkSelectBlock');
	var pkInfoBlock = document.getElementById('pkInfoBlock');
	var pkInfoContentBlock = document.getElementById('pkInfoContentBlock');
	var readPKButton = document.getElementById('readPKButton');

	if (readPKButton.value == "Change") {
		showDimmer('Reset private key...');
		g_euSign.ResetPrivateKey()
		.then(function() {
			pkSelectBlock.style.display = "block";
			pkInfoBlock.style.display = "none";
			readPKButton.value = "Read";
			
			hideDimmer();
		})
		.catch(function(e) {
			hideDimmer();
					
			var msg = (e.message || e);
			
			console.log("Reset private key error: " + msg);
	
			alert('An error occurred while reset private key. ' + 
				'Error description: ' + msg);
		});
		return;
	}
	
	showDimmer('Reading private key...');
	
	readPrivateKey()
	.then(function(info) {		
		console.log("EndUser: private key readed " + info.subjCN + ".");

		pkInfoContentBlock.innerHTML = 
			"<ul>" +
			"<b>Subject:</b> " + info.subjCN + "<br>" +
			"<b>DRFO:</b> " + info.subjDRFOCode + "<br>" +
			"<b>EDRPOU:</b> " + info.subjEDRPOUCode + "<br>" +
			"<b>Issuer:</b> " + info.issuerCN + "<br>" +
			"<b>Serial:</b> " + info.serial + 
			"</ul>";
		
		pkSelectBlock.style.display = "none";
		pkInfoBlock.style.display = "block";
		readPKButton.value = "Change";		
		
		hideDimmer();
	})
	.catch(function(e) {
		hideDimmer();
				
		var msg = (e.message || e);
		
		console.log("Read private key error: " + msg);

		alert('An error occurred while reading private key. ' + 
			'Error description: ' + msg);
	});
}

//===============================================================================

function onSignDocuments() {
	var readPKButton = document.getElementById('readPKButton');
	var documentsWithSignBlock = 
		document.getElementById('documentsWithSignBlock');
	var documentsWithSignContentBlock = 
		document.getElementById('documentsWithSignContentBlock');
	if (readPKButton.value != "Change") {
		alert("Please, read private key");
		return;
	}

	documentsWithSignContentBlock.innerHTML = '';
	
	showDimmer('Sign documents...');
	
	var signAlgo = EndUserConstants.EndUserSignAlgo.DSTU4145WithGOST34311;
	var hashes = [];
	for (var i = 0; i < documentsToSign.length; i++) {
		hashes.push({
			name: documentsToSign[i].name,
			val: documentsToSign[i].hash
		});
	}
	
	g_euSign.SignHash(signAlgo, hashes, true, true)
	.then(function (signatures) {
		showDimmer('Sending to server...');
		
		var request = {};
		var documents = [];
		
		for (var i = 0; i < signatures.length; i++) {
			documents.push({
				'name': signatures[i].name,
				'signature': signatures[i].val
			});
		}	
		request['documents'] = documents;
		
		
		return makeRequest("/api/v1/documents/", request, "json");
	})
	.then(function(response) {
		var documents = response['documents'];
		var innerHTML = '';
		
		innerHTML += '<ol type="1">';
		for (var i = 0; i < documents.length; i++) {
			innerHTML += 
				'<li>' +
				'<b>' + documents[i].name + '</b>' + '<br>' + 
				'<b>Sign info:</b>' + 
				'<ol type="1">';
				for (var j = 0; j < documents[i]['signInfos'].length; j++) {
					var info = documents[i]['signInfos'][j];
					innerHTML +=
						"<li>" +
						"<b>Subject:</b> " + info.subjCN + "<br>" +
						"<b>DRFO:</b> " + info.subjDRFOCode + "<br>" +
						"<b>EDRPOU:</b> " + info.subjEDRPOUCode + "<br>" +
						"<b>Issuer:</b> " + info.issuerCN + "<br>" +
						"<b>Serial:</b> " + info.serial + "<br>" + 
						"<b>IsTimeStamp:</b> " + info.isTimeStamp + "<br>" + 
						"<b>Time:</b> " + info.time + 
						"</li>";		
				}
			innerHTML += '</ol>';
			innerHTML += '</li>';
		}
		innerHTML += '</ol>';
		
		documentsWithSignContentBlock.innerHTML = innerHTML;
		documentsWithSignBlock.style.display = 'block';
		
		hideDimmer();
	})
	.catch(function(e) {
		documentsWithSignBlock.style.display = 'none';
		
		hideDimmer();
		
		var msg = (e.message || e);
		
		console.log("Sign documents error: " + msg);

		alert('An error occurred while signing documents. ' + 
			'Error description: ' + msg);
	})	
}

//===============================================================================

function onUpdateDocumentsToSign() {
	showDimmer('Download documents to sign...');
	
	var hashAlgo = EndUserConstants.EndUserHashAlgo.GOST34311;
	
	makeRequest("/api/v1/documents/?hashAlgo=" + hashAlgo, null, "json")
	.then(function(response) {
		documentsToSign = response['documents'];
		
		var documentsToSignBlock = 
			document.getElementById('documentsToSignBlock');
		var documentsToSignContentBlock = 
			document.getElementById('documentsToSignContentBlock');
		var innerHTML = '';
		
		innerHTML += '<ol type="1">';
		for (var i = 0; i < documentsToSign.length; i++) {
			innerHTML += 
				'<li>' +
				'<b>' + documentsToSign[i].name + '</b>' + '<br>' + 
				'<b>Hash:</b>' + documentsToSign[i].hash +
				'</li>';
		}
		innerHTML += '</ol>';
		
		documentsToSignContentBlock.innerHTML = innerHTML;
		documentsToSignBlock.style.display = "block";
		
		
		hideDimmer();
	})
	.catch(function(e) {
		hideDimmer();
		
		var msg = (e.message || e);
		
		console.log("Download documents to sign error: " + msg);

		alert('An error occurred while downloading documents ' + 
			'to sign from server. Error description: ' + msg);
	});	
}

//===============================================================================

window.addEventListener("load", function (event) {
	document.getElementById('readPKButton').addEventListener(
		'click', onReadPKey, false);

	document.getElementById('signButton').addEventListener(
		'click', onSignDocuments, false);
	
	onUpdateDocumentsToSign();
});

//===============================================================================