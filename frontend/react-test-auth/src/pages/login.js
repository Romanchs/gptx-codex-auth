import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import { useLoginMutation } from '@/store/api';
export default function Login() {
  const [step, setStep] = useState('credentials');
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const tokenRef = useRef(null);
  const signatureRef = useRef(null);

  const [login, { data, error }] = useLoginMutation();

  const onNext = async () => {
    if (step === 'credentials') {
      if (!usernameRef.current.value) return alert('Please, enter login');
      if (!passwordRef.current.value) return alert('Please, enter password');
      setStep('sign');
    } else {
      try {
        document.getElementById('dimmer').style.display = 'block';
        await window.readPrivateKey();
        const sign = await window.g_euSign.SignData(tokenRef.current.value, true);
        signatureRef.current.value = sign;
        await login({
          username: usernameRef.current.value,
          password: passwordRef.current.value,
          token: tokenRef.current.value,
          signature: sign,
        }).unwrap();
      } catch (e) {
        console.error(e);
        alert('Sign error: ' + (e.message || e));
      } finally {
        document.getElementById('dimmer').style.display = 'none';
      }
    }
  };

  return (
    <>
      <Head />
      <form className="loginForm" id="loginForm" onSubmit={e => e.preventDefault()}>
        <h2 style={{ textAlign: 'center' }}>Two-Factor Authentication (2FA)</h2>
        <div id="loginBlock" style={{ display: step === 'credentials' ? 'block' : 'none' }}>
          <div className="input-field" style={{ display: 'none' }}>
            <input type="text" ref={tokenRef} id="token" defaultValue="test token" />
          </div>
          <div className="input-field" style={{ display: 'none' }}>
            <input type="text" ref={signatureRef} id="signature" />
          </div>
          <div className="input-field">
            <input type="text" ref={usernameRef} id="username" placeholder="Login" />
          </div>
          <div className="input-field">
            <input type="password" ref={passwordRef} id="password" placeholder="Password" />
          </div>
        </div>

        <div className="dimmer" id="dimmer" style={{ display: 'none' }}>
          <div className="dimmer-content">
            <label id="dimmerText">Loading...</label>
            <div id="dimmerContent"></div>
          </div>
        </div>

        <div id="pkBlock" style={{ display: step === 'sign' ? 'block' : 'none' }}>
          <div id="pkTypeBlock">
            <p>Select private key media type</p>
            <hr />
            <div className="radio-button">
              <input type="radio" id="pkTypeFile" name="pkType" defaultChecked />
              <label htmlFor="pkTypeFile">File</label>
            </div>
            <div className="radio-button">
              <input type="radio" id="pkTypeKeyMedia" name="pkType" />
              <label htmlFor="pkTypeKeyMedia">Token</label>
            </div>
            <div className="radio-button">
              <input type="radio" id="pkTypeKSP" name="pkType" />
              <label htmlFor="pkTypeKSP">Cloud</label>
            </div>
            <hr />
          </div>
          <div id="pkCABlock">
            <label>CA:</label>
            <div className="select-field">
              <select id="pkCASelect"></select>
            </div>
            <br />
          </div>
          <div id="pkFileBlock">
            <label>Private key file:</label>
            <br />
            <br />
            <input id="pkFile" type="file" style={{ display: 'none' }} />
            <div>
              <input
                type="button"
                value="Select"
                style={{ margin: 0 }}
                onClick={() => document.getElementById('pkFile').click()}
              />
              <label id="pkFileName" style={{ paddingLeft: '0.1rem' }}></label>
            </div>
            <div className="select-field">
              <select id="pkFileAliasSelect" style={{ display: 'none' }}></select>
            </div>
            <div className="input-field">
              <input type="password" id="pkFilePassword" placeholder="Private key password" />
            </div>
          </div>
          <div id="pkKeyMediaBlock" style={{ display: 'none' }}>
            <label>Token:</label>
            <div className="select-field">
              <select id="pkKeyMediaSelect"></select>
            </div>
            <div className="input-field">
              <input type="password" id="pkKeyMediaPassword" placeholder="Private key password" />
            </div>
          </div>
          <div id="pkKSPBlock" style={{ display: 'none' }}>
            <label>Cloud provider:</label>
            <div className="select-field">
              <select id="pkKSPSelect"></select>
            </div>
            <div id="pkKSPUserIdBlock" className="input-field">
              <input id="pkKSPUserId" placeholder="Client ID" />
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }} id="navBlock">
          {step === 'sign' && (
            <input id="backButton" type="button" value="< Back" onClick={() => setStep('credentials')} />
          )}
          <input id="nextButton" type="button" value="Next >" onClick={onNext} />
        </div>
        {data && <p>Authorized</p>}
        {error && <p>Error</p>}
      </form>
    </>
  );
}
