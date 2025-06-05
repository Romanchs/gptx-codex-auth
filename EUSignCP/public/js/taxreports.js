//===============================================================================

/*
	To simplify the example, only the director key is used to protect/unprotect reports
*/
var pkDirectorContext = null;
/* Tax server certificate to protect reports */
var taxServerCert = null;
var taxReports = null;

//===============================================================================

const DEFAULT_DATE_FORMAT = "dd.MM.yyyy hh:mm:ss";

function formatDate(date, format) {
	var z = {
		M: date.getMonth() + 1,
		d: date.getDate(),
		h: date.getHours(),
		m: date.getMinutes(),
		s: date.getSeconds()
	};
	format = format.replace(/(M+|d+|h+|m+|s+)/g, function(v) {
		return ((v.length > 1 ? "0" : "") + z[v.slice(-1)]).slice(-2);
	});
				
	return format.replace(/(y+)/g, function(v) {
		return date.getFullYear().toString().slice(-v.length);
	});
}

//===============================================================================

function onReadPKey() {
	var pkSelectBlock = document.getElementById('pkSelectBlock');
	var pkInfoBlock = document.getElementById('pkInfoBlock');
	var pkInfoContentBlock = document.getElementById('pkInfoContentBlock');
	var readPKButton = document.getElementById('readPKButton');

	if (readPKButton.value == "Change") {
		showDimmer('Reset private key...');
		g_euSign.CtxFreePrivateKey()
		.then(function() {
			pkDirectorContext = null;
			
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
	
	ctxReadPrivateKey()
	.then(function(pkContext) {
		pkDirectorContext = pkContext;
		var info = pkContext.ownerInfo;
		
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

function onSendTaxReports() {
	var readPKButton = document.getElementById('readPKButton');
	var taxReceiptsBlock = 
		document.getElementById('taxReceiptsBlock');
	var taxReceiptsContentBlock = 
		document.getElementById('taxReceiptsContentBlock');
	if (readPKButton.value != "Change") {
		alert("Please, read private key");
		return;
	}

	taxReceiptsContentBlock.innerHTML = '';
	
	showDimmer('Protect tax reports...');
		
	var pkAccountantContext = null;
	var pkStampContext = null;
	var senderEMail = "test@mail.com";
	
	g_euSign.ProtectTaxReports(
		pkAccountantContext, pkDirectorContext, pkStampContext,
		senderEMail, taxServerCert, taxReports)
	.then(function (reports) {
		showDimmer('Sending to server...');
		
		var request = {};
		var taxReports = [];
		
		for (var i = 0; i < reports.length; i++) {
			if (reports[i].error.code != EndUserError.EU_ERROR_NONE)
				throw reports[i].error;
			
			taxReports.push({
				'name': reports[i].name,
				'data': base64Encode(reports[i].data)
			});
		}	
		request['taxReports'] = taxReports;
		
		return makeRequest("/api/v1/taxreports/", request, "json");
	})
	.then(function(response) {
		var taxReceipts = response['taxReceipts'];
		for (var i = 0; i < taxReceipts.length; i++) {
			taxReceipts[i].data = base64Decode(taxReceipts[i].data);
		}
		
		return g_euSign.UnprotectTaxReceipts(pkDirectorContext, taxReceipts);
	})
	.then(function(taxReceipts) {
		var innerHTML = '';	
		
		innerHTML += '<ol type="1">';
		for (var i = 0; i < taxReceipts.length; i++) {
			innerHTML += 
				'<li>' +
				'<b>Receipt #' + (i + 1) + '</b>' + '<br>' + 
				'<b>Sender(s) info:</b>';
			if (taxReceipts[i].error.code != EndUserError.EU_ERROR_NONE) {
				innerHTML += '<b style="color:red">Error:</b>' +
					'<span style="color:red">' + taxReceipts[i].error.message + '</span>';
			} else {
				innerHTML +=
					'<ol type="1">';
					for (var j = 0; j < taxReceipts[i]['initiators'].length; j++) {
						var initiator = taxReceipts[i]['initiators'][j];
						innerHTML +=
							"<li>" +
							"<b>Subject:</b> " + initiator.ownerInfo.subjCN + "<br>" +
							"<b>DRFO:</b> " + initiator.ownerInfo.subjDRFOCode + "<br>" +
							"<b>EDRPOU:</b> " + initiator.ownerInfo.subjEDRPOUCode + "<br>" +
							"<b>Issuer:</b> " + initiator.ownerInfo.issuerCN + "<br>" +
							"<b>Serial:</b> " + initiator.ownerInfo.serial + "<br>" + 
							"<b>IsTimeStamp:</b> " + initiator.timeInfo.isTimeStamp + "<br>" + 
							"<b>Time:</b> " + formatDate(initiator.timeInfo.time, DEFAULT_DATE_FORMAT) + 
							"</li>";		
					}
				innerHTML += '</ol>';
			}
			innerHTML += '</li>';
		}
		innerHTML += '</ol>';
		
		taxReceiptsContentBlock.innerHTML = innerHTML;
		taxReceiptsBlock.style.display = 'block';
		
		hideDimmer();
	})
	.catch(function(e) {
		taxReceiptsBlock.style.display = 'none';
		
		hideDimmer();
		
		var msg = (e.message || e);
		
		console.log("Protect tax reports error: " + msg);

		alert('An error occurred while protecting tax reports. ' + 
			'Error description: ' + msg);
	})	
}

//===============================================================================

function onUpdateTaxReports() {
	showDimmer('Download tax reports...');
	
	makeRequest("/api/v1/taxreports/", null, "json")
	.then(function(response) {
		
		taxServerCert = base64Decode(response['taxServerCert']);
		taxReports = response['taxReports'];
		for (var i = 0; i < taxReports.length; i++) {
			taxReports[i].data = base64Decode(taxReports[i].data);
		}
		
		var taxReportsBlock = 
			document.getElementById('taxReportsBlock');
		var taxReportsContentBlock = 
			document.getElementById('taxReportsContentBlock');
		var innerHTML = '';
		
		innerHTML += '<ol type="1">';
		for (var i = 0; i < taxReports.length; i++) {
			innerHTML += 
				'<li>' +
				'<b>' + taxReports[i].name + '</b>' +
				'</li>';
		}
		innerHTML += '</ol>';
		
		taxReportsContentBlock.innerHTML = innerHTML;
		taxReportsBlock.style.display = "block";
		
		
		hideDimmer();
	})
	.catch(function(e) {
		hideDimmer();
		
		var msg = (e.message || e);
		
		console.log("Download tax reports error: " + msg);

		alert('An error occurred while downloading tax reports ' + 
			'from server. Error description: ' + msg);
	});	
}

//===============================================================================

window.addEventListener("load", function (event) {
	document.getElementById('readPKButton').addEventListener(
		'click', onReadPKey, false);

	document.getElementById('sendButton').addEventListener(
		'click', onSendTaxReports, false);
	
	onUpdateTaxReports();
});

//===============================================================================