//===============================================================================

const PK_FORM_TYPE_FILE = 1;
const PK_FORM_TYPE_KM = 2;
const PK_FORM_TYPE_KSP = 3;

//===============================================================================

// Crypto library settings
var euSettings = {
	language: "en",
	encoding: "utf-8",
	httpProxyServiceURL: "proxyhandler",
	directAccess: false,
	CAs: "./Data/CAs.Test.All.json",
	CACertificates: "./Data/CACertificates.Test.All.p7b",
	allowedKeyMediaTypes: [
		"е.ключ ІІТ Алмаз-1К", 
		"е.ключ ІІТ Кристал-1",
		"ID-карта громадянина (БЕН)",
		"е.ключ ІІТ Алмаз-1К (PKCS#11)",
		"е.ключ ІІТ Кристал-1 (PKCS#11)"
	],
	// Register Cloud providers
	"KSPs": [
		{
			"name": "ІІТ - хмарний підпис (2)",
			"ksp": EndUserConstants.EndUserKSP.IIT,
			"address": "https://sserver2.iit.com.ua",
			"port": "443"
		},
		{
			"name": "Приватбанк - хмарний підпис \"SmartID\"",
			"ksp": EndUserConstants.EndUserKSP.PB,
			"address": "https://acsk.privatbank.ua/cloud/api/back/",
			"port": "",
			"directAccess": false,
			"clientIdPrefix": "IIT_",
			"confirmationURL": "https://www.privat24.ua/rd/kep",
			"mobileAppName": "Приват24"
		}
	]
};

// A library for working with file keys and signature servers that don't need it
// installation of additional software
var euSignFile = new EndUser(
	"js/euscp.worker.ex.js", 
	EndUserConstants.EndUserLibraryType.JS);
	
// A library for working with hardware media that needs it additional
// installation of web signature library software, web extension for the browser
var euSignKeyMedia = new EndUser(
	null, 
	EndUserConstants.EndUserLibraryType.SW);
var keyMedias = [];
var CAs = null;

var g_euSign = euSignFile;
var formType = PK_FORM_TYPE_FILE;
var isKSPSupported = false;

//===============================================================================

function makeRequest(url, data, dataType) {
	return new Promise((resolve, reject) => {
		try {
			var xmlHttp = new XMLHttpRequest();
			xmlHttp.onload = function() {
				if (xmlHttp.readyState != 4)
					return;

				var result = null;
				try {
					if (xmlHttp.status != 200) {
						throw 'Download data error. URL - ' + 
							url + ', status - ' + xmlHttp.status;
					}

					switch (dataType) {
						case 'binary':
							result = new Uint8Array(xmlHttp.response);
							break;

						case 'json':
							result = JSON.parse(
								xmlHttp.responseText.replace(/\\'/g, "'"));
							break;

						default:
							result = xmlHttp.responseText;
							break;
					}
				} catch (e) {
					console.log("DowloadData error: " + e);
					reject(e);
					return;
				}

				resolve(result);
			};
			xmlHttp.onerror = function(e) {
				reject(e);
			};
		
			xmlHttp.open(data ? "POST" : "GET", url, true);
			if (data) {
				if (dataType == 'binary') {
					xmlHttp.responseType = 'arraybuffer';
					xmlHttp.send(data);
				} else {
					xmlHttp.setRequestHeader(
						"Content-Type", "application/json");
					xmlHttp.send(JSON.stringify(data));				
				}
						
			} else {
				if (dataType == 'binary')
					xmlHttp.responseType = 'arraybuffer';
				xmlHttp.send();	
			}
		} catch (e) {
			reject(e);
		}
	});
}

//===============================================================================

function base64Encode(bytes) {
    return btoa(String.fromCharCode.apply(null, bytes));
}

//-------------------------------------------------------------------------------

function base64Decode(b64Str) {
    var binStr = atob(b64Str);
    var bytes = new Uint8Array(binStr.length);
    for (var i = 0; i < binStr.length; i++) {
        bytes[i] = binStr.charCodeAt(i);
    }
    return bytes;
}

//===============================================================================

function readFile(file) {
	return new Promise(function(resolve, reject) {
		var reader = new FileReader();
		reader.onloadend  = function(evt) {
			if (evt.target.readyState != FileReader.DONE)
				return;

			resolve({
				"file": file,
				"data": new Uint8Array(evt.target.result)
			});
		};
		reader.readAsArrayBuffer(file);
	});
}

//-------------------------------------------------------------------------------

function readFiles(files) {
	return new Promise(function(resolve, reject) {
		var results = [];
		var index = 0;
		var _next = function() {
			if (index >= files.length) {
				resolve(results);
				return;
			}

			readFile(files[index])
			.then((result) => {
				results.push(result);
				_next();
			})
			.catch((e) => reject(e));
			index++;
		}

		_next();
	});
}

//===============================================================================

function getKeyMedia(pkKMSelect) {
	for (var i = 0; i < keyMedias.length; i++) {
		if (pkKMSelect.value == keyMedias[i].visibleName)
			return keyMedias[i];
	}

	return null;
}

//-------------------------------------------------------------------------------

function updateKeyMedias(euSign, pkKMSelect) {
	return new Promise(function(resolve, reject) {
		euSign.GetKeyMedias()
		.then(function(_keyMedias) {
			keyMedias = _keyMedias;
			
			var length = pkKMSelect.options.length;
			for (i = length-1; i >= 0; i--) {
				pkKMSelect.options[i] = null;
			}
			
			for (var i = 0; i < keyMedias.length; i++) {
				var opt = document.createElement('option');
				opt.appendChild(document.createTextNode(
					keyMedias[i].visibleName));
				opt.value = keyMedias[i].visibleName; 
				pkKMSelect.appendChild(opt); 
			}
			
			resolve();
		})
		.catch(function(e) {
			var msg = (e.message || e);
			
			console.log("Update key medias failed with error: " + msg);
			
			reject(e);
		});
	});
}

//===============================================================================

function getCA(pkCASelect) {
	for (var i = 0; i < CAs.length; i++) {
		for (var j = 0; j < CAs[i].issuerCNs.length; j++) {
			if (pkCASelect.value == CAs[i].issuerCNs[j])
				return CAs[i];	
		}
	}

	return null;
}

//-------------------------------------------------------------------------------

function updateCAs(euSign, pkCASelect) {
	return new Promise(function(resolve, reject) {
		if (CAs) {
			resolve();
			return;
		}
			
		euSign.GetCAs()
		.then(function(_CAs) {
			CAs = _CAs;
			
			var length = pkCASelect.options.length;
			for (i = length-1; i >= 0; i--) {
				pkCASelect.options[i] = null;
			}
			
			var opt = document.createElement('option');
			opt.appendChild(document.createTextNode('Auto'));
			opt.value = 'Auto'; 
			pkCASelect.appendChild(opt);
			
			for (var i = 0; i < CAs.length; i++) {
				for (var j = 0; j < CAs[i].issuerCNs.length; j++) {
					opt = document.createElement('option');
					opt.appendChild(document.createTextNode(
						CAs[i].issuerCNs[j]));
					opt.value = CAs[i].issuerCNs[j]; 
					pkCASelect.appendChild(opt);
				}
			}
			
			resolve();
		})
		.catch(function(e) {
			var msg = (e.message || e);
			
			console.log("Update CAs failed with error: " + msg);
			
			reject(e);
		});
	});
}

//===============================================================================

function getKSP(pkKSPSelect) {
	for (var i = 0; i < euSettings.KSPs.length; i++) {
		if (euSettings.KSPs[i].name == pkKSPSelect.value)
			return euSettings.KSPs[i];
	}

	return null;	
}

//-------------------------------------------------------------------------------

function updateKSPs(pkKSPSelect) {
	return new Promise(function(resolve, reject) {
		try {
			if (!pkKSPSelect ||
				pkKSPSelect.options.length > 0) {
				resolve();
				return;
			}
			
			var length = pkKSPSelect.options.length;
			for (i = length-1; i >= 0; i--) {
				pkKSPSelect.options[i] = null;
			}
			
			for (var i = 0; i < euSettings.KSPs.length; i++) {
				var opt = document.createElement('option');
				opt.appendChild(document.createTextNode(
					euSettings.KSPs[i].name) );
				opt.value = euSettings.KSPs[i].name; 
				pkKSPSelect.appendChild(opt); 
			}
			
			resolve();
		} catch (e) {
			var msg = (e.message || e);
			
			console.log("Update KSPs failed with error: " + msg);
			reject(e);
		}
	});
}

//===============================================================================

function updateKeyAlias(euSign, pkFileInput, pkAliasSelect) {
	return new Promise(function(resolve, reject) {
		pkAliasSelect.style.display = 'none';
		var length = pkAliasSelect.options.length;
		for (i = length-1; i >= 0; i--) {
			pkAliasSelect.options[i] = null;
		}

		if (!pkFileInput.value ||
				pkFileInput.files <= 0 ||
				!pkFileInput.files[0].name.endsWith(".jks")) {
			resolve();
			return;
		}
		
		readFile(pkFileInput.files[0])
		.then(function(pkFile) {
			return euSign.GetJKSPrivateKeys(pkFile.data);
		})
		.then(function(jksKeys) {
			for (var i = 0; i < jksKeys.length; i++) {
				var opt = document.createElement('option');
				opt.appendChild(document.createTextNode(
						jksKeys[i].alias));
				opt.value = jksKeys[i].alias; 
				pkAliasSelect.appendChild(opt);			
			}

			pkAliasSelect.style.display = 'block';
		})
		.catch(function(e) {
			var msg = (e.message || e);
			
			console.log("Update key alias failed with error: " + msg);
			
			reject(e);
		});
	});
}

//===============================================================================

// Ініціалізація бібліотеки
function initialize() {
	return new Promise(function(resolve, reject) {
		var isInitialized = false;
		
		if (g_euSign == euSignFile) {
			g_euSign.IsInitialized()
			.then(function(result) {
				isInitialized = result;
				if (isInitialized) {
					console.log("EndUser: JS library already initialized");
					return;
				}
				
				console.log("EndUser: JS library initializing...");
				return g_euSign.Initialize(euSettings);
			}).then(function() {
				if (isInitialized)
					return;

				console.log("EndUser: JS library initialized");
				
				console.log("EndUser: event listener for KSPs registering...");
				
				return g_euSign.AddEventListener(
					EndUserConstants.EndUserEventType.ConfirmKSPOperation,
					onConfirmKSPOperation);
			}).then(function() {
				if (!isInitialized)
					console.log("EndUser: event listener for KSPs registered");

				isInitialized = true;
				resolve();
			})
			.catch(function(e) {
				reject(e);
			});
		} else {
			// Checking whether the necessary modules for the operation of the 
			// cryptographic library are installed
			g_euSign.GetLibraryInfo()
			.then(function(result) {
				if (!result.supported) {
					throw "The web signature library is not " + 
						"supported by your browser or OS";
				}
				
				if (!result.loaded) {
					// Library already installed, but need update
					if (result.isNativeLibraryNeedUpdate) {
						throw "The web signature library needs update." +
							"Please install the update from the link " + 
							result.nativeLibraryInstallURL;
					}
					
					// Recommended if the browser supports the web extension
					// install web extensions in addition to native modules
					// WARNING! Installation of web extensions is MANDATORY for 
					// Linux OS and Windows Server OS
					if (result.isWebExtensionSupported &&
						!result.isWebExtensionInstalled) {
						throw "The web signature library needs to install " + 
							"the web extension. Please install the " + 
							"web extension from the link " +
							result.webExtensionInstallURL + " and update page";
					}
					
					// The library (native modules) is not installed
					throw "The web signature library needs to be installed." +
						"Please install the library from the link " +
						result.nativeLibraryInstallURL + " and update page";
				}
				
				return g_euSign.IsInitialized();
			})
			.then(function(result) {
				isInitialized = result;
				if (isInitialized) {
					console.log("EndUser: SW library already initialized");
					return;
				}
				
				console.log("EndUser: SW library initializing...");
				return g_euSign.Initialize(euSettings);
			}).then(function() {
				if (!isInitialized)
					console.log("EndUser: SW library initialized");
				
				resolve();
			})
			.catch(function(e) {
				reject(e);
			});
		}
	});
}

//===============================================================================

function readPKey(
	libType, pkFileInput, pkFileAliasSelect, pkPasswordInput, pkKMSelect,
	pkKSPSelect, pkKSPUserId, pkCertsFileInput, caCNSelect, usePKContext) {

	var euSign = libType == EndUserConstants.EndUserLibraryType.JS ?
		euSignFile : euSignKeyMedia;
	
	return new Promise(function(resolve, reject) {
		if (pkFileInput != null) {
			/* Read private key from file */
			if (!pkFileInput.value) {
				pkFileInput.focus();

				reject('Please, select private key file');

				return;
			}
			
			if (pkFileAliasSelect && 
				!pkFileAliasSelect.value) {
				pkFileAliasSelect.focus();

				reject('Please, select private key alias');

				return;		
			}
			
			if (!pkPasswordInput.value) {
				pkPasswordInput.focus();
				
				reject('Please, enter private key password');

				return;
			}
			
			var ctx = {
				pkData: null,
				pkPassword: pkPasswordInput.value,
				pkCerts: null,
				caCN: caCNSelect ? caCNSelect.value : null
			};
			
			readFile(pkFileInput.files[0])
			.then(function(pkFile) {
				console.log("Private key file readed");
				
				ctx.pkData = pkFile.data;
				
				if (!pkFileAliasSelect)
					return null;
				
				return euSign.GetJKSPrivateKeys(ctx.pkData);
			}).then(function(jksKeys) {
				if (jksKeys) {
					console.log("Private key get keys from JKS");
								
					ctx.pkData = null;
					ctx.pkCerts = [];
					for (var i = 0; i < jksKeys.length; i++) {
						if (pkFileAliasSelect.value != jksKeys.alias)
							continue;
						
						ctx.pkData = jksKeys[i].privateKey;
						for (var j = 0; j < jksKeys[i].certificates.length; j++) {
							ctx.pkCerts.push(jksKeys[i].certificates[j].data);
						}
						
						break;
					}
					
					if (!ctx.pkData) {
						throw "Key with " + pkFileAliasSelect.value + 
						" alias was not found in jks container";
					}
					
					return null;
				}
				
				if (!pkCertsFileInput)
					return null;
				
				return readFiles(pkCertsFileInput.files);
			})
			.then(function(pkCerts) {
				if (pkCerts) {
					console.log("Private key certificates files readed");
					
					ctx.pkCerts = [];
					for (var i = 0; i < pkCerts.length; i++) {
						ctx.pkCerts.push(pkCerts[i].data);
					}
				}
				
				return usePKContext ?
					euSign.CtxReadPrivateKeyBinary(
						null, ctx.pkData, ctx.pkPassword,
						ctx.pkCerts, ctx.caCN) :
					euSign.ReadPrivateKeyBinary(
						ctx.pkData, ctx.pkPassword,
						ctx.pkCerts, ctx.caCN);
			})
			.then(function(result) {
				resolve(result);
			})
			.catch(function(e) {
				reject(e);
			});
		} else if (pkKMSelect != null) {
			/* Read private key from token */
			
			var km = getKeyMedia(pkKMSelect);
			if (!km) {
				pkKMSelect.focus();

				reject('Please, select private key media');

				return;
			}
			
			if (!pkPasswordInput.value) {
				pkPasswordInput.focus();
				
				reject('Please, enter private key password');

				return;
			}
		
			var readCerts = new Promise(function(resolve, reject) {
				if (!pkCertsFileInput) {
					resolve();
					return;
				}
				
				readFiles(pkCertsFileInput.files)
				.then(resolve)
				.catch(reject);
			});
			var caCN = caCNSelect ? caCNSelect.value : null;
			var pkKM = new EndUserKeyMedia(km);
			pkKM.password = pkPasswordInput.value;
			
			readCerts
			.then(function(pkCertsFiles) {
				var pkCerts = null;
				if (pkCertsFiles) {
					console.log("Private key certificates files readed");
					
					pkCerts = [];
					for (var i = 0; i < pkCertsFiles.length; i++) {
						pkCerts.push(pkCertsFiles[i].data);
					}
				}
				
				return usePKContext ?
					euSign.CtxReadPrivateKey(
						null, pkKM, pkCerts, caCN) :
					euSign.ReadPrivateKey(
						pkKM, pkCerts, caCN);
			})
			.then(function(result) {
				resolve(result);
			})
			.catch(function(e) {
				reject(e);
			});
		} else if (pkKSPSelect != null) {
			/* Read private key from cloud provider */
			
			var ksp = getKSP(pkKSPSelect);
			if (ksp == null) {
				pkKSPSelect.focus();
				
				reject('Please, select cloud provider');

				return;
			}
			
			if (!ksp.confirmationURL && 
					!pkKSPUserId.value) {
				pkKSPUserId.focus();

				reject('Please, enter user id');
				
				return;
			}
			
			if (usePKContext) {
				throw "Private key context not supported for KSPs";
			}

			euSign.ReadPrivateKeyKSP(
				!ksp.confirmationURL ? 
					pkKSPUserId.value : '', ksp.name)
			.then(function(result) {
				resolve(result);
			})
			.catch(function(e) {
				reject(e);
			});	
			
		} else {
			reject('Please, specify pkFileInput, pkKMSelect or pkKSPSelect');
			
			return;
		}
	});
}

//===============================================================================

function showDimmer(text, content) {
	document.getElementById('dimmer').style.display = 'block';
	if (text)
		document.getElementById('dimmerText').innerHTML = text;
	
	if (content) {
		document.getElementById('dimmerContent').innerHTML = content;
		document.getElementById('dimmerContent').style.display = 'block';
	} else {
		document.getElementById('dimmerContent').innerHTML = '';
		document.getElementById('dimmerContent').style.display = 'none';
	}
}

//-------------------------------------------------------------------------------

function hideDimmer() {
	document.getElementById('dimmer').style.display = 'none';
}

//===============================================================================

/*
	A operation confirmation handler for private key operation in the cloud.
	Shows a QR code to scan in the signature service mobile app
*/
function onConfirmKSPOperation(kspEvent) {
	var node = '';
	node += '<br>';
	node += '<label>Please, scan QR-code to confirm operation ' +
		'in mobile application</label>';
	node += '<br><br>';
	node += '<div>';
	node += '<a href="' + kspEvent.url + '">';
	node += 	'<img src="data:image/bmp;base64,' + 
		kspEvent.qrCode + '" style="padding: 10px; background: white;">';
	node += '</a>';
	node += '</div>';
	
	showDimmer(null, node);
}

//===============================================================================

function setLibraryType(type) {
	var pkCABlock = document.getElementById('pkCABlock');
	var pkCASelect = document.getElementById('pkCASelect');
	var pkFileBlock = document.getElementById('pkFileBlock');
	var pkKeyMediaBlock = document.getElementById('pkKeyMediaBlock');
	var pkKSPBlock = document.getElementById('pkKSPBlock');
	var pkKMSelect = document.getElementById('pkKeyMediaSelect');
	var pkKSPSelect = document.getElementById('pkKSPSelect');
	
	formType = type;
	
	switch (type) {
		case PK_FORM_TYPE_FILE:
			pkCABlock.style.display = 'block';
			pkFileBlock.style.display = 'block';
			pkKeyMediaBlock.style.display = 'none';
			if (isKSPSupported)
				pkKSPBlock.style.display = 'none';
			g_euSign = euSignFile;
		break;

		case PK_FORM_TYPE_KM:
			pkCABlock.style.display = 'block';
			pkFileBlock.style.display = 'none';
			pkKeyMediaBlock.style.display = 'block';
			if (isKSPSupported)
				pkKSPBlock.style.display = 'none';
			g_euSign = euSignKeyMedia;
		break;
		
		case PK_FORM_TYPE_KSP:
			pkCABlock.style.display = 'none';
			pkFileBlock.style.display = 'none';
			pkKeyMediaBlock.style.display = 'none';
			if (isKSPSupported)
				pkKSPBlock.style.display = 'block';
			g_euSign = euSignFile;
		break;
	}
	
	initialize()
	.then(function() {
		if (g_euSign == euSignFile)
			return updateKSPs(pkKSPSelect);
		
		return updateKeyMedias(g_euSign, pkKMSelect);
	})
	.then(function() {
		return updateCAs(g_euSign, pkCASelect);
	})
	.then(function() {
	})
	.catch(function(e) {
		var msg = (e.message || e);
		
		console.log("Initialize error: " + msg);

		alert('An error occurred while initializing library. ' + 
			'Error description: ' + msg);
	});
}

//===============================================================================

function readPrivateKey() {
	var libType = formType == PK_FORM_TYPE_KM ? 
		EndUserConstants.EndUserLibraryType.SW : 
		EndUserConstants.EndUserLibraryType.JS;
	
	var pkFileInput = formType == PK_FORM_TYPE_FILE ? 
		document.getElementById('pkFile') : null;
	var pkFileAliasSelect = formType == PK_FORM_TYPE_FILE &&
		document.getElementById('pkFileAliasSelect').style.display != 'none' ?
		document.getElementById('pkFileAliasSelect') : null;
		
	var pkPasswordInput = formType != PK_FORM_TYPE_KSP ? 
		document.getElementById(formType == PK_FORM_TYPE_FILE ? 
			'pkFilePassword' : 'pkKeyMediaPassword') : null;
	var pkKMSelect = formType == PK_FORM_TYPE_KM ? 
		document.getElementById('pkKeyMediaSelect') : null;
	var pkKSPSelect = formType == PK_FORM_TYPE_KSP ? 
		document.getElementById('pkKSPSelect') : null;
	var pkKSPUserIdInput = formType == PK_FORM_TYPE_KSP ? 
		document.getElementById('pkKSPUserId') : null;	
	/*
		Certificates corresponding to key (an array of Uint8Array type objects).
		If null, the library tries to download them from the CA automatically from the CMP server.
		It is installed in cases where CA does not support CMP, and for acceleration
		search private key certificate
	*/
	var pkCertsFileInput = null;
	/*
		Common name of the CA from the CAs.json list that issued the certificate for the private key
		If null, the library tries to determine the CA automatically by
		CMP server\certificate. It is established in cases where the CA is not
		supports CMP, and to speed up the search for the private key certificate
	 */	
	var caCNSelect = formType != PK_FORM_TYPE_KSP &&
		getCA(document.getElementById('pkCASelect')) ?
		document.getElementById('pkCASelect') : null;
	
	return readPKey(libType, pkFileInput, pkFileAliasSelect, 
		pkPasswordInput, pkKMSelect, pkKSPSelect, pkKSPUserIdInput,
		pkCertsFileInput, caCNSelect, false);
}

//===============================================================================

function ctxReadPrivateKey() {
	var libType = formType == PK_FORM_TYPE_KM ? 
		EndUserConstants.EndUserLibraryType.SW : 
		EndUserConstants.EndUserLibraryType.JS;
	
	var pkFileInput = formType == PK_FORM_TYPE_FILE ? 
		document.getElementById('pkFile') : null;
	var pkFileAliasSelect = formType == PK_FORM_TYPE_FILE &&
		document.getElementById('pkFileAliasSelect').style.display != 'none' ?
		document.getElementById('pkFileAliasSelect') : null;
		
	var pkPasswordInput = formType != PK_FORM_TYPE_KSP ? 
		document.getElementById(formType == PK_FORM_TYPE_FILE ? 
			'pkFilePassword' : 'pkKeyMediaPassword') : null;
	var pkKMSelect = formType == PK_FORM_TYPE_KM ? 
		document.getElementById('pkKeyMediaSelect') : null;
	var pkKSPSelect = formType == PK_FORM_TYPE_KSP ? 
		document.getElementById('pkKSPSelect') : null;
	var pkKSPUserIdInput = formType == PK_FORM_TYPE_KSP ? 
		document.getElementById('pkKSPUserId') : null;	
	/*
		Certificates corresponding to key (an array of Uint8Array type objects).
		If null, the library tries to download them from the CA automatically from the CMP server.
		It is installed in cases where CA does not support CMP, and for acceleration
		search private key certificate
	*/
	var pkCertsFileInput = null;
	/*
		Common name of the CA from the CAs.json list that issued the certificate for the private key
		If null, the library tries to determine the CA automatically by
		CMP server\certificate. It is established in cases where the CA is not
		supports CMP, and to speed up the search for the private key certificate
	 */	
	var caCNSelect = formType != PK_FORM_TYPE_KSP &&
		getCA(document.getElementById('pkCASelect')) ?
		document.getElementById('pkCASelect') : null;
	
	return readPKey(libType, pkFileInput, pkFileAliasSelect, 
		pkPasswordInput, pkKMSelect, pkKSPSelect, pkKSPUserIdInput,
		pkCertsFileInput, caCNSelect, true);
}

//===============================================================================

window.addEventListener("load", function (event) {
	document.getElementById('pkTypeFile').addEventListener(
			'click', function() {
				setLibraryType(PK_FORM_TYPE_FILE);
			}, false);

	document.getElementById('pkTypeKeyMedia').addEventListener(
		'click', function() {
			setLibraryType(PK_FORM_TYPE_KM);
		}, false);

	isKSPSupported = document.getElementById('pkTypeKSP') != null;
	
	if (isKSPSupported) {
		document.getElementById('pkTypeKSP').addEventListener(
			'click', function() {
				setLibraryType(PK_FORM_TYPE_KSP);
			}, false);
	
		
		document.getElementById('pkKSPSelect').addEventListener(
			'change', function() {
				var ksp = getKSP(document.getElementById('pkKSPSelect'));
				document.getElementById('pkKSPUserIdBlock').style.display = 
					(ksp != null && ksp.confirmationURL) ? 
					'none' : 'block';
			}, false);
	}
	
	document.getElementById('pkFile').addEventListener(
		'change', function() {
			document.getElementById('pkFileName').innerHTML = 
				document.getElementById('pkFile').files.length > 0 ? 
				document.getElementById('pkFile').files[0].name : "";
				
			updateKeyAlias(g_euSign, 
				document.getElementById('pkFile'), 
				document.getElementById('pkFileAliasSelect'));
		}, false);
	
	setLibraryType(PK_FORM_TYPE_FILE);
});

//===============================================================================
