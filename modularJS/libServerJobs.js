'use strict'

/**
 * Returns a promise, which resolves to a DOM img element and rejects with an error message string
 * 
 * @param {string} path DocumentRoot relative server path of the required image
 */
export function getImg(path) {
    let img = document.createElement('img');
    return new Promise(function(resolve, reject) {
        img.src = path;
        img.onload = () => resolve(img);
        img.onerror = (err) => reject('Failed to load image ' + path); // err does not give any cue to why the loading failed
    });
} 

/**
 * Returns a promise, that resolves to an object with properties 'imgServerName' and 'errmess'.
 * =================
 * imgServerName is the name of the image in the server's file system.
 * 'errmess' should be an empty string. If an error occurs in the php function called with the 'url' parameter
 * 'errmess' gives a clue to the error. In that case 'imgServerName' may be undefined 
 * It is the responsability of the php script 'url' to return a json string, encoding these two properties
 * 
 * @param {string} url the url of the PHP script handling the upload server side
 * @param {string} sessname the name of the session, that will be used by the server script 'url'
 * @param {string} name name of the emulated input element of type "file"
 * @param {*} file the file to upload
 * @param {string} filename the file name reported to the server
 */
export function uploadImg(url, sessname, name, file, filename) {
    // Build a form, that will be posted
    let formData = new FormData();
    formData.append(name, file, filename);
    formData.append('xcommand', 1); // Take command numbers from the constants in axchange.php
    formData.append('sessname', sessname);
    formData.append('jsonparams', JSON.stringify({})); // No jsaon parameters
    return fetch(url, {
        method: 'POST',
        body: formData
    })
    .then(
        // We implement only the first function of then. Success and failure is handled together.
        response => response.json() // Two properties 'imgServerName' and 'errmess'
    )
}

export function uploadTxt(url, id, txt) {
    // Build a form, that will be posted
    let formData = new FormData();
    formData.append('id', id)
    formData.append('txt', txt);
    formData.append('type', 'imgEdQst');
    return fetch(url, {
        method: 'POST',
        body: formData
    })
    .then(
        response => response.json()
    )
}

/* Works equally well
export async function uploadImg(url, name, file, filename) {
    // Build a form, that will be posted
    let formData = new FormData();
    formData.append(name, file, filename);
    formData.append('type', 'img');
    let posting = await fetch(url, {
        method: 'POST',
        body: formData
    });
    return posting.json();
}
*/

/**
 * Returns a promise for a json string, which is the response when a given POST variable is sent to url
 * 
 * @param {string} url 
 * @param {string} postname 
 * @param {*} postvalue 
 * @returns 
 */
export function getJson(url, postname, postvalue) {
    let formData = new FormData();
    formData.append(postname, postvalue);
    return fetch(url, {
        method: 'POST',
        body: formData
    })
    .then(
        response => response.json()
    )
}