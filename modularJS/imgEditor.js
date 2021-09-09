'use strict'

import {stdRect, posInRect, resizeCursor} from './libGeometry.js';
import {getImg, uploadImg, uploadTxt, getJson} from './libServerJobs.js';

const imagesDir = "./isImg/";

const dropM = 1;
const resizeM = 2;
const areaChoiceM = 3;
const areaTxtM = 4;
const areaDeleteM = 5;
const syncDimsM = 6;

const resizeBorder = 10; // This refers to image resizing only
const placeholderResizeBorder = 20;

const minPlaceholderPx = 12; // Minimla intrinsic height and width of a placeholder

const plhTxtT = 'plhTxtT'; // The placeholder holds a text area
const plhImgT = 'plhImgT'; // The placeholder holds an image

let sessname = ''; // The name of the session on the server

/**
 * Returns the position of the top left corner of element in document coordinates
 * 
 * @param {obj} element a DOM node 
 */
function elementPos(element) {
    let boundingClientRect = element.getBoundingClientRect();
    let pos = {
        x: boundingClientRect.left + document.documentElement.scrollLeft,
        y: boundingClientRect.top + document.documentElement.scrollTop
    }
    return pos;
}

/**
 * Returns the position of the mouse event e in coordinates of the target of the event
 * The origin of the coordinate system is the left upper corner of the target
 * 
 * @param {mouse event} e 
 */
function relMousePos(e) {
    let ePos = elementPos(e.target);
    let pos = {
        x: e.pageX - ePos.x,
        y: e.pageY - ePos.y
    }
    return pos;
}

/**
 * Used to prevent defaults in  ['dragenter', 'dragover', 'dragleave', 'drag']
 * @param {object} e 
 */
 function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

/**
 * Encodes data about an image in an image placeholder or in a gallery as string
 * 
 * @param {obj} img 
 * @returns string
 */
function encodeImgData(img) {    
    let parentNode = img.parentNode;
    if (parentNode.className == 'imedEditorPlaceholderImg') {
        // The image is part of a placeholder
        return 'editorPlh  =' + parentNode.id;
    } else if (parentNode.className == 'imedQuestionPlaceholderImg') {        
        return 'questionPlh=' + parentNode.id;
    } else if (parentNode.className == 'imedIsGallery') {
        // The image is in the gallery
        data = 'gallery    =' + img.src;
    }
}

/**
 * 
 * @param {string} data 
 * @returns object with properties 'origin' (one of 'placeholder', 'gallery')
 * and either ['type' (one of 'isEditor', 'isQuestion') and 'id'] or ['src']
 */
function decodeImgData(data) {
    let head = data.slice(0, 12);
    let tail = data.slice(12);
    if (head == 'editorPlh  =') {
        return {
            'origin': 'placeholder',
            'type': 'isEditor',
            'id': tail
        }
    } else if (head == 'questionPlh=') {
        return {
            'origin': 'placeholder',
            'type': 'isQuestion',
            'id': tail
        }
    } else if (head == 'gallery    =') {
        return {
            'origin': 'gallery',
            'src': tail
        }
    } else {
        return undefined;
    }
}

/**
 * This dragstart handler is intended to work for all images in a placeholder or in the gallery.
 * It sets data of type text, depending on the parent node of the image target
 * 
 * @param {object} e 
 */
function uImgDragstartH(e) {
    let data = encodeImgData(e.target);
    console.log('uImgDragstartH sets data: ' + data);
    e.dataTransfer.setData('text/plain', data);
}

export let isImedInstances = {
    create: function(type, name, json) {
        let item;
        switch (type) {
            case 'IsImgEditor':
                if (!(name in this.items)) {
                    item = new IsImgEditor(json);
                }
                break;
            case 'IsImgQuestion':
                if (!(name in this.items)) {
                    item = new IsImgQuestion(json);
                }
                break;
            case 'IsImgSolution':
                if (!(name in this.items)) {
                    item = new IsImgSolution(json);
                }
                break;
            case 'IsImgAnswer':
                if (!(name in this.items)) {
                    item = new IsImgAnswer(json);
                }
                break;
            default:
                alert('Unknown type ' + type);
        }
        if (!(name in this.items)) {
            this.items[name] = item;
        }
        console.log('Just created instance ' + name);
        return this.items[name];
    },
    get: function(name) {
        if (name in this.items) {
            return this.items[name];
        } else {
            alert (name + ' not found in instances.items');
        }
    },
    id() {
        return this.items.length + 1;
    },
    items: {}
}

/**
 * Base class for EditorImgContainer and QuestionImgContainer.
 * 'img' is a dom node for the base image, which has already been loaded
 * 'baseImage' is the name of the image on the server
 */
class ImgContainer {
    constructor(parentClass, img, magFactor, baseImage) {
        this.parentClass = parentClass;
        this.img = img;
        this.img.className = 'imedIsImg';
        // Prevent parts turning blue
        this.img.classList.add('selectDisable');
        this.height = img.naturalHeight;
        this.width = img.naturalWidth;
        // this.height and this.width refer to the intrinsic coordinate system, 
        // with origin in the upper left corner of the imgContainer.
        // The intrinsic coordinate System is transformed to the representation coordinate system
        // by homothetical expansion by the factor this.magFactor.
        if (this.height > 0) {
            this.ratio = this.width / this.height;
        } else {
            this.ratio = 1;
        };
        this.magFactor = magFactor;
        this.baseImage = baseImage;
        this.container = document.createElement('div');
        this.container.className = 'imedImgContainer';
        // Insert the image as a child of imgContainer
        this.container.appendChild(this.img);
    }
    getRepDims() {
        return {
            height: this.magFactor * this.height,
            width: this.magFactor * this.width
        }
    }
    setRepDims(height, width) {        
        this.container.style.height = height + 'px';
        this.container.style.width = width + 'px';
    }
    applyGeometry() {
        let repDims = this.getRepDims();
        this.setRepDims(repDims.height, repDims.width);
        if (this.placeholders) {
           this.placeholders.applyGeometry(this.magFactor);
        }
    }
    /**
     * Returns the name of the appropriate cursor type, when the mouse has position 'mousePos'
     * (an object witjh properties 'x' and 'y') within this.container
     * 
     * @param {object} mousePos 
     */
    borderCursor(mousePos) { 
        // console.log('container width = ' + this.container.clientWidth + ', mouse x = ' + mousePos.x);               
        let rect = {height: this.container.clientHeight, width: this.container.clientWidth};
        let rectpos = posInRect(mousePos, rect, resizeBorder); // Position in the rectangle of imgContainer
        // console.log('rectpos = ' + rectpos);
        let activePositions = new Set(['bottom', 'right']);
        return resizeCursor(rectpos, activePositions);
    }
    representation() {
        return {
            baseImage : this.baseImage,
            height: this.height,
            width: this.width,
            ratio: this.ratio,
            magFactor: this.magFactor,
            placeholders: this.placeholders.representation()
        }
    }
}

class QuestionImgContainer extends ImgContainer {
    constructor(parentClass, img, magFactor, baseImage) {
        super(parentClass, img, magFactor, baseImage);
        this.placeholders = new QuestionPlaceholders(this);
        this.applyGeometry();
    }
    applyGeometry() {
        super.applyGeometry();
    }
}

class SolutionImgContainer extends ImgContainer {
    constructor(parentClass, img, magFactor, baseImage) {
        super(parentClass, img, magFactor, baseImage);
        this.placeholders = new SolutionPlaceholders(this);
        this.applyGeometry();
    }
    applyGeometry() {
        super.applyGeometry();
    }
}

class AnswerImgContainer extends ImgContainer {
    constructor(parentClass, img, magFactor, baseImage) {
        super(parentClass, img, magFactor, baseImage);
        this.placeholders = new AnswerPlaceholders(this);
        this.applyGeometry();
    }
    applyGeometry() {
        super.applyGeometry();
    }
}

class EditorImgContainer extends ImgContainer{
    constructor(parentClass, img, magFactor, baseImage) {
        super(parentClass, img, magFactor, baseImage); 
        this.serverRepId = 0; // id of the server representation, initially 0, set only when the representation is stored
        // Insert a canvas on top of the image
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'imedImgCanvas';
        // Bind event listen ers for canvas. This does not add them, it just binds them to canvas
        this.boundCanvasMousedownH = this.canvasMousedownH.bind(this);
        this.boundCanvasMouseupH = this.canvasMouseupH.bind(this);
        this.boundCanvasMousemoveH = this.canvasMousemoveH.bind(this);
        this.boundCanvasMouseoutH = this.canvasMouseoutH.bind(this);
        this.container.appendChild(this.canvas);
        this.areaFixing = false;
        this.areaStartPt = undefined;
        this.areaEndPt = undefined;
        this.placeholders = new EditorPlaceholders(this);
        this.applyGeometry(); 
    }
    applyGeometry() {
        super.applyGeometry();
        // adapt the canvas
        let dims = this.getRepDims();
        this.canvas.height = dims.height;
        this.canvas.width = dims.width;
    }
    canvasMousedownH(e) {
        // console.log('canvas mouse down');
        // If a mouseup has been missed on canvas, because we are out of canvas when releasing the mouse button,
        // There could be a mouse down, when we are still fixing the area. 
        // This would result in a falsification of the original startPt.
        if (this.areaStartPt == undefined) {
            this.areaFixing = true;
            this.canvas.style.cursor = 'crosshair';
            this.areaStartPt = relMousePos(e); // canvas relative mouse position
            this.areaEndPt = this.areaStartPt;
        }
    }
    boundCanvasMouseDownH = undefined // Can be bound only in constructor, when the object exists
    canvasMouseupH(e) {
        // console.log('canvas mouseup');
        if (this.areaFixing) {
            let ctx = this.canvas.getContext('2d');
            // Clear the whole canvas
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            // Use an empty string to remove the crosshair corsor. 
            // Do not set it to default. This would override the underlying workspace cursor used for imgContainer resizing
            this.canvas.style.cursor = '';
            // Insert placeholder or txtholder
            // let placeholderId = this.parentClass.id + '_plh_' + this.placeholders.nr();
            let placeholderId = this.placeholders.nextFreeId();
            let reprect = stdRect(this.areaStartPt, this.areaEndPt); // repRect is in representation coordinates
            let fullrect = {
                top: reprect.top / this.magFactor,
                left: reprect.left / this.magFactor,
                height: reprect.height / this.magFactor,
                width: reprect.width / this.magFactor
            };
            let ph = undefined;
            if (this.parentClass.currentMode == areaTxtM) {
                // Insert a placeholder for a text area
                ph = new EditorPlaceholder(this.placeholders, placeholderId, plhTxtT, fullrect);
            } else {
                // Insert a placeholder for an image container
                ph = new EditorPlaceholder(this.placeholders, placeholderId, plhImgT, fullrect);
            }
            this.placeholders.append(ph);
            ph.applyGeometry(this.magFactor);
            this.areaFixing = false;
            this.areaStartPt = undefined;
        }
    }
    boundCanvasMouseUpH = undefined
    canvasMousemoveH(e) {
        // console.log('canvasMousemove x=' + e.pageX + ', y=' + e.pageY);
        if (this.areaFixing) {
            if (this.canvas) {
                let ctx = this.canvas.getContext('2d');
                // Clear the whole canvas
                ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                // Draw new rectangle
                this.areaEndPt = relMousePos(e); // canvas relative mouse position
                let newWidth = this.areaEndPt.x - this.areaStartPt.x;
                let newHeight = this.areaEndPt.y - this.areaStartPt.y;
                ctx.strokeStyle = 'red';
                ctx.strokeRect(this.areaStartPt.x, this.areaStartPt.y, newWidth, newHeight);
            }
        } else {
            // If default is not prevented, while the button is pressed, the siblings, i.e. the placeholders with images turn blue (active)
            // console.log('canvas mousemove prevent default');
            if (e.button == 0) {
                e.preventDefault();
            }
        }
    }
    boundCanvasMousemoveH = undefined
    canvasMouseoutH(e) {
        // console.log('canvas mouseout');
    }
    boundCanvasMouseoutH = undefined
}
    
class Placeholders {
    constructor(parentImgContainer) {
        this.parentImgContainer = parentImgContainer; // Backreference to class ImgContainer of which this is the property 'placeholders'
        this.items = [];
    }
    append(placeholder) {
        // console.log('append placeholder ' + placeholder.id);
        this.items.push(placeholder);
        this.parentImgContainer.container.appendChild(placeholder.domElement);
    }
    /**
     * Returns a unique id for the next placeholder. Id's are <editor id>_plh_<unique number>
     * The unique number is 1 or the maximum of present numbers + 1
     * 
     * @returns string id
     */
    nextFreeId() {
        let prefix = this.parentImgContainer.parentClass.id + '_plh_';
        let maxNr = 0;
        for (let item of this.items) {
            let nr = Number(item.id.slice(prefix.length));
            if (nr > maxNr) {
                maxNr = nr;
            }
        };
        maxNr++;
        return prefix + maxNr;
    }
    applyGeometry(magFactor) {
        for (let item of this.items) {
            item.applyGeometry(magFactor);
        }
    }
    getImgByName(name) {        
        for (let i = 0; i < this.items.length; i++) {
            if (this.items[i].type == plhImgT && 
                this.items[i].domElement?.lastElementChild &&
                this.items[i].domElement.lastElementChild.src == name) {
                return this.items[i].domElement.lastElementChild;
            }
        }
    }
    getImgByPlaceholderId(id) {
        let plh = document.getElementById(id);
        if (plh && plh.lastElementChild) {
            return plh.lastElementChild;
        }
    }
    representation() {
        let rep = [];
        for (let item of this.items) {
            rep.push(item.representation());
        }
        return rep;
    }
    loadTextContent() {
        for (let item of this.items) {
            if (item.type == plhTxtT) { 
                item.domElement.children[0].value = item.content;
            }
        }
    }
    async loadImageContent() {
        for (let item of this.items) {
            if (item.type == plhImgT) {  
                if (item.content != '') { 
                    let img = await getImg('hashedImages/' + item.content);
                    img.className = 'imedIsPlaceholderImg';
                    item.domElement.appendChild(img);
                }
            }
        }
    }
}

class QuestionPlaceholders extends Placeholders{
    constructor(parentImgContainer) {
        super(parentImgContainer);
    }
    /**
     * Each placeholder is represented by an object, looking like:
        {
            type: <type of placeholder plhImgT or PlhTxtT
            id: <unique id of placeholder>
            content: <Type dependent. Server name of image or text of the textarea>
            fullRect: this.fullrect
        }
    * 
    * @param {array} reps array of placholder Representations
    */
    load(reps) {
        for (let rep of reps) {
            let plh = new QuestionPlaceholder(this, rep.id,rep.type,rep.fullRect, undefined); 
            this.append(plh);
        }
    }
    removeImg(id) {
        for (let plh of this.items) {
            if (plh.type == plhImgT && plh.id == id) {
                plh.domElement.removeChild(plh.domElement.lastElementChild);
                // Reestablish the original class
                plh.domElement.className = 'imedQuestionPlaceholderImg';
                // Reestablish the original size
                plh.fullrect = plh.clone(plh.oriFullrect);
                plh.applyGeometry(this.parentImgContainer.magFactor);
            }
        }
    }
}

class SolutionPlaceholders extends Placeholders{
    constructor(parentImgContainer) {
        super(parentImgContainer);
    }
    shrinkImages() {
        for (let item of this.items) {
            item.shrinkToImg();
            let magFactor = this.parentImgContainer.magFactor;
            this.applyGeometry(magFactor);
        }
    }
    /**
     * Each placeholder is represented by an object, looking like:
        {
            type: <type of placeholder plhImgT or PlhTxtT
            id: <unique id of placeholder>
            content: <Type dependent. Server name of image or text of the textarea>
            fullRect: this.fullrect
        }
    * 
    * @param {array} reps array of placholder Representations
    */
    async load(reps) {
        for (let rep of reps) {
            let plh = new SolutionPlaceholder(this, rep.id,rep.type,rep.fullRect); 
            plh.content = rep.content;           
            this.append(plh);
        }
        // Images and text must be loaded separately, because if they are mixed and text is loaded after an image
        // in the same async method, the text does not get loaded
        await this.loadImageContent();
        this.shrinkImages();
        this.loadTextContent();
    }
}

class AnswerPlaceholders extends Placeholders{
    constructor(parentImgContainer) {
        super(parentImgContainer);
    }
    shrinkImages() {
        for (let item of this.items) {
            item.shrinkToImg();
            let magFactor = this.parentImgContainer.magFactor;
            this.applyGeometry(magFactor);
        }
    }
    /**
     * Each placeholder is represented by an object, looking like:
        {
            type: <type of placeholder plhImgT or PlhTxtT
            id: <unique id of placeholder>
            content: <Type dependent. Server name of image or text of the textarea>
            fullRect: this.fullrect
        }
    * 
    * @param {array} reps array of placholder Representations
    */
    async load(reps) {
        for (let rep of reps) {
            if (rep.eval !== undefined) {
                console.log('Evaluation = ' + rep.eval);
            }
            let plh = new AnswerPlaceholder(this, rep.id, rep.type, rep.fullRect, rep.eval); 
            plh.content = rep.content;   
            this.append(plh);
        }
        // Images and text must be loaded separately, because if they are mixed and text is loaded after an image
        // in the same async method, the text does not get loaded
        await this.loadImageContent();
        this.shrinkImages();
        this.loadTextContent();
    }
}

class EditorPlaceholders extends Placeholders {
    constructor(parentImgContainer) {
        super(parentImgContainer);
        // Used to resize placeholders and to sync image dimensions
        this.currentIndex = undefined;
        this.currentContactPt = undefined;
        this.currentResizePosition = undefined;
        this.resizingPlaceholders = false;
    }
    indexFromDomId(id) {
        let index = undefined;
        for (let index = 0; index < this.items.length; index++) {
            if (this.items[index].domElement.id == id) {
                return index;
            }
        }
        return index;
    }
    remove(domId) {
        let index = this.indexFromDomId(domId);
        if (index !== undefined)  {
            this.items[index].domElement.remove();
            this.items.splice(index, 1);
        }
    }
    placeholderFromId(id) {
        let ph = undefined;
        for (let item of this.items) {
            if (item.id == id) {
                ph = item;
            }
        }
        return ph;
    }
    terminateResizing() {
        if (this.resizingPlaceholders) {   
            this.currentIndex = undefined;
            this.currentResizePosition = undefined;
            this.parentImgContainer.container.style.cursor = '';
            this.resizingPlaceholders = false;
        }
    }
    setImgPlhRects(height, width) {
        for (let item of this.items) {
            if (item.type == plhImgT) {
                item.adjustRectangle(height, width);
            }
        }
    }
    defaultImgPlhRects() {
        this.setImgPlhRects(this.parentImgContainer.parentClass.plhHeight, this.parentImgContainer.parentClass.plhWidth);
        // this.setImgPlhRects(100, 100);
    }
    syncImgPlaceholders(index) {
        this.setImgPlhRects(this.items[index].fullrect.height, this.items[index].fullrect.width);
    }
    /**
     * Each placeholder is represented by an object, looking like:
        {
            type: <type of placeholder plhImgT or PlhTxtT
            id: <unique id of placeholder>
            content: <Type dependent. Server name of image or text of the textarea>
            fullRect: this.fullrect
        }
    * 
    * @param {array} reps array of placholder Representations
    */
    async load(reps) {
        for (let rep of reps) {
            let plh = new EditorPlaceholder(this, rep.id,rep.type,rep.fullRect); 
            plh.content = rep.content;           
            this.append(plh);
        }
        // Images and text must be loaded separately, because if they are mixed and text is loaded after an image
        // in the same async method, the text does not get loaded
        await this.loadImageContent();
        this.loadTextContent();
    }
    /**
     * If yes == true disables all textareas in placeholders, if false reenables them
     * 
     * @param {bool} yes 
     */
    disableTextareas(yes) {
        for (let item of this.items) {
            if (item.type == plhTxtT && item.domElement.lastElementChild) {
                item.domElement.lastElementChild.disabled = yes;
                 //Set the cursor to textarea default. Strictly necessary only when reenabling textareas (yes == false)
                item.domElement.lastElementChild.style.cursor = '';
            }
        }
    }
    isImgPlhLike(element) {
        return (element.className && element.className == 'imedEditorPlaceholderImg' ||
                element.parentNode && element.parentNode.className && element.parentNode.className == 'imedEditorPlaceholderImg')
    }
    isTxtPlhLike(element) {
        return (element.className && element.className == 'imedEditorPlaceholderTxt' ||
                element.parentNode && element.parentNode.className && element.parentNode.className == 'imedEditorPlaceholderTxt')
    }
    isPlhLike(element) {
        return this.isImgPlhLike(element) || this.isTxtPlhLike(element)
    }
    placeholderMouseupH(e) {
        // console.log('imgContainer mouseup on ' + this.currentIndex);
        this.terminateResizing();
    }
    boundPlaceholderMouseupH = this.placeholderMouseupH.bind(this)    
    /**
     * This handler triggers on the DOM <div> element container, which holds the base image
     * 
     * @param {obj} e 
     */
    placeholderMousemoveH(e) {
        // console.log('imgContainerMousemove');
        if (this.currentIndex !== undefined && this.resizingPlaceholders) {
            // We are resizing a placeholder. Leave the cursor as it is
            console.log('resizing placeholder. Position=' + this.currentResizePosition);
            let xDelta = (e.pageX - this.currentContactPt.x) / this.parentImgContainer.magFactor;
            let yDelta = (e.pageY - this.currentContactPt.y) / this.parentImgContainer.magFactor;
            this.currentContactPt.x = e.pageX;
            this.currentContactPt.y = e.pageY;
            this.items[this.currentIndex].adjustDimensions(this.currentResizePosition, xDelta, yDelta);
            // The following prevents highlighting, when the mouse leaves the placeholder
            e.preventDefault();
        } else {  
            // We are moving around the image container and detect if we are on a placeholder and change the cursor accordingly 
            if (this.isPlhLike(e.target)) {         
                // console.log('Placeholder mousemove, current index ' + this.currentIndex);
                // Do nothing but adapt the cursor appearance to the position within the placeholder
                let pos = relMousePos(e); // position relative to the placeholder
                // Check the mouse position within the target to determine the possible resizing actions
                let rect = {height: e.target.clientHeight, width: e.target.clientWidth};
                this.currentResizePosition = posInRect(pos, rect, placeholderResizeBorder);
                let activePositions = new Set(['top', 'bottom', 'left', 'right', 'center']);
                let newCursor = resizeCursor(this.currentResizePosition, activePositions);
                // console.log('new cursor ' + newCursor);
                // Apply the relevant cursor, if it is not already displayed
                if (this.parentImgContainer.container.style.cursor != newCursor) {
                    this.parentImgContainer.container.style.cursor = newCursor;
                    // If the target is a textarea, it does not inherit the cursor from the parent, so set it,
                    // but only if textareas are disabled. In resize mode text areas are disabled.
                    // We do not reset the cursor to inherit here. It is easier to reset all textarea cursors when reenabling them
                    if (e.target.tagName == 'TEXTAREA' && e.target.disabled) {
                        e.target.style.cursor = newCursor;
                    }
                }
            } else {
                // We are no longer on a placeholder
                this.parentImgContainer.container.style.cursor = '';
            }
        }
    }
    boundPlaceholderMousemoveH = this.placeholderMousemoveH.bind(this)
    placeholderMousedownH(e) {
        if (this.isPlhLike(e.target)) {
            // console.log('Placeholder mousedown');
            let targetElement = e.target;
            // HTML tag names are always upper case. 
            // We assume, that there is at most one child of a placeholder dom element's DIV
            if (targetElement.nodeName != 'DIV') {
                targetElement = targetElement.parentElement;
            }
            this.currentIndex = this.indexFromDomId(targetElement.id);
            this.currentContactPt = {x: e.pageX, y: e.pageY};
            this.resizingPlaceholders = true;
            console.log('resizing current placeholder ' + this.currentIndex);
        }
    }
    boundPlaceholderMousedownH = this.placeholderMousedownH.bind(this);
    /**
     * This is needed only to reset the cursor on the placeholder or the child image, whichever is the target.
     * Without that, leaving resizeM mode would leave behind a wrong style.cursor if the placeholder has been resized.
     * Upon entering the placeholder or the image in any mode except resizeM, would display always the same
     * wrong cursor, when the mouse is on placeholder or the image.
     * mouesout and NOT mouseleave, since mouseleave does not bubble
     * 
     * @param {obj} e 
     */
    placeholderMouseoutH(e) {
        if (!this.resizingPlaceholders) {
            e.target.style.cursor = '';
        }
    }
    boundPlaceholderMouseoutH = this.placeholderMouseoutH.bind(this)
    placeholderDelMouseoverH(e) {
        e.target.style.cursor = 'pointer';
    }
    boundPlaceholderDelMouseoverH = this.placeholderDelMouseoverH.bind(this)
    placeholderDelMouseoutH(e) {
        e.target.style.cursor = 'default';
    }
    boundPlaceholderDelMouseoutH = this.placeholderDelMouseoutH.bind(this)
    placeholderDelClickH(e) {
        let targetElement = e.target;
        // HTML tag names are always upper case. 
        // We assume, that there is at most one child of a placeholder dom element's DIV
        if (targetElement.nodeName != 'DIV') {
            targetElement = targetElement.parentElement;
        }
        this.remove(targetElement.id);
    }
    boundPlaceholderDelClickH = this.placeholderDelClickH.bind(this);
    /**
     * This handler is attached to imgContainer in mode syncDymsM
     * 
     * @param {obj} e 
     */ 
    syncDimsMousemoveH(e) {
        if (this.currentIndex !== undefined && this.resizingPlaceholders) {
            console.log('resizing placeholder. Position=' + this.currentResizePosition);
            let xDelta = (e.pageX - this.currentContactPt.x) / this.parentImgContainer.magFactor;
            let yDelta = (e.pageY - this.currentContactPt.y) / this.parentImgContainer.magFactor;
            this.currentContactPt.x = e.pageX;
            this.currentContactPt.y = e.pageY;
            this.items[this.currentIndex].adjustDimensions(this.currentResizePosition, xDelta, yDelta);
            this.syncImgPlaceholders(this.currentIndex);
            // The following prevents highlighting, when the mouse leaves the placeholder
            e.preventDefault();
        } else {
            // We act only on images and empty placeholders. 
            // console.log('syncDimsMousemove on ' , e.target);
            if (this.isImgPlhLike(e.target)) {
                // console.log('Placeholder mousemove, current index ' + this.currentIndex);
                // Do nothing but adapt the cursor appearance to the position within the placeholder
                let pos = relMousePos(e); // position relative to the placeholder
                // Check the mouse position within the target to determine the possible resizing actions
                let rect = {height: e.target.clientHeight, width: e.target.clientWidth};
                this.currentResizePosition = posInRect(pos, rect, placeholderResizeBorder);
                let activePositions = new Set(['top', 'bottom', 'left', 'right']);
                let newCursor = resizeCursor(this.currentResizePosition, activePositions);
                console.log('Position ' + this.currentResizePosition + ' new cursor ' + newCursor);
                // Apply the relevant cursor, if it is not already displayed
                if (this.parentImgContainer.container.style.cursor != newCursor) {
                    this.parentImgContainer.container.style.cursor = newCursor;
                    console.log('placeholderMousemoveH set new cursor ' + newCursor + 
                                ' on target with tag ' + this.parentImgContainer.container.tagName);
                }
                // console.log('imgContainerMousemove');
            } else {
                // We are no longer on a placeholder
                this.parentImgContainer.container.style.cursor = '';
            }
        }
    }
    boundSyncDimsMousemoveH = this.syncDimsMousemoveH.bind(this)
    syncDimsMousedownH(e) {
        if (this.isImgPlhLike(e.target)) {
            // console.log('syncDims mousedown');
            let targetElement = e.target;
            // HTML tag names are always upper case. 
            // We assume, that there is at most one child of a placeholder dom element's DIV
            if (targetElement.nodeName != 'DIV') {
                targetElement = targetElement.parentElement;
            }
            this.currentIndex = this.indexFromDomId(targetElement.id);
            this.currentContactPt = {x: e.pageX, y: e.pageY};
            this.resizingPlaceholders = true;
            console.log('synchronizing on current placeholder ' + this.currentIndex);
        }
    }
    boundSyncDimsMousedownH = this.syncDimsMousedownH.bind(this);
    syncDimsMouseupH(e) {
        this.terminateResizing();
    }
    boundSyncDimsMouseupH = this.syncDimsMouseupH.bind(this);
    addPlaceholderDeleteListeners() { 
        for (let item of this.items) {
            item.domElement.addEventListener('mouseover', this.boundPlaceholderDelMouseoverH);
            item.domElement.addEventListener('mouseout', this.boundPlaceholderDelMouseoutH);
            item.domElement.addEventListener('click', this.boundPlaceholderDelClickH);
        }
    }
    removePlaceholderDeleteListeners() {
        for (let item of this.items) {
            item.domElement.removeEventListener('mouseover', this.boundPlaceholderDelMouseoverH);
            item.domElement.removeEventListener('mouseout', this.boundPlaceholderDelMouseoutH);
            item.domElement.removeEventListener('click', this.boundPlaceholderDelClickH);
        }
    }
    attatchDraggingHandlers() {
        for (let item of this.items) {
            // The placeholder must hold an image
            if (item.type == plhImgT  && item.domElement.lastElementChild) {
                // item.domElement.lastElementChild.addEventListener('dragover', item.imgDragoverH);
                item.domElement.lastElementChild.addEventListener('dragstart', item.boundImgDragstartH);
            }
        }
    }
}

class Placeholder {
    constructor(parentPlaceholders, id, type, fullrect) {
        this.parentPlaceholders = parentPlaceholders;
        this.id = id;
        this.type = type;
        // this.fullrect is the full position of the placeholder rectangle expressed in intrinsic coordinates
        // The properties 'top' 'left', 'height', 'width' refer to the intrinsic coordinate system
        this.fullrect = fullrect;
        // type dependent
        this.content = undefined; // Will be either the name of the image or the text of the textarea
        // Insert in DOM
        this.domElement = document.createElement('div');
        this.domElement.id = this.id;
        if (type == plhTxtT) {
            let textarea = document.createElement('textarea');
            textarea.className = 'imedIsPlaceholderTxt';
            this.domElement.appendChild(textarea);
        } else if (type == plhImgT) {
            // Allow drop on placeholders holding an image, The drop handler is defined in derived classes
            // To allow a drop the default handling of dragover must be prevented
            this.domElement.addEventListener('dragover', (e) => e.preventDefault());
        };
        // Save the original placeholder dimensions. It is used to shrink the placeholder
        this.oriFullrect = this.clone(fullrect);
        this.setMinima();
    }
    /**
     * Applies the recorded geometry to the DOM element,
     * taking into account the current dimension of the imgContainer
     * 
     * @param {Number} magFactor The magnification factor from the intrinsic coordinate system to representation system
     */
    applyGeometry(magFactor) {
        // console.log('apply placeholder geometry to placeholder ' + this.id + ' height=' + this.fullrect.height);
        // console.log('applyGeometry ratio ' + this.fullrect.width / this.fullrect.height);
        this.domElement.style.width = magFactor * this.fullrect.width + 'px';
        this.domElement.style.height = magFactor * this.fullrect.height+ 'px';
        this.domElement.style.left = magFactor * this.fullrect.left + 'px';
        this.domElement.style.top = magFactor * this.fullrect.top + 'px';
    }
    setMinima() {
        // If intrinsic height or width fall below minPlaceholderPx, they are set to minPlaceholderPx
        if (this.fullrect.height < minPlaceholderPx) {
            this.fullrect.height = minPlaceholderPx;
        };
        if (this.fullrect.width < minPlaceholderPx) {
            this.fullrect.width = minPlaceholderPx;
        };
    }
    representation() {
        if (this.domElement.lastElementChild) {
            if (this.type == plhTxtT) {
                // Set the text in the text area as content
                this.content = this.domElement.lastElementChild.value;
            } else if (this.type = plhImgT) {
                this.content = this.domElement.lastElementChild.src.split('/').pop();
            }
        } else {
            this.content = '';
        }
        // Strip the leding part of the id, which is particular to this IsImg instance
        // This is the part before the first underscore. Placeholder id's are 'IsImg.id_plh_x'
        // where x is a unique integer. After stripping the id in the representation is just 'phl_x'
        let upos = this.id.indexOf('_');
        let strippedId = undefined;
        if (upos >= 0) {
            strippedId = this.id.slice(upos + 1); // +1 to eliminate the undescore
        } else {
            strippedId = this.id;
        }
        return {
            type: this.type,
            id: strippedId,
            content: this.content,
            fullRect: this.fullrect
        }
    }
    clone(obj) {
        let clone = {}
        for(let key in obj) {
            clone[key] = obj[key];
        }
        return clone;
    }
    shrinkToImg() {
        if (this.type == plhImgT && this.domElement.lastElementChild) {
            // Return to original placeholder dimensions to prevent a shrinking chain alternately shrinking width and height
            // console.log('current height=' + this.fullrect.height + ', original height=' + this.oriFullrect.height);
            // console.log('current width=' + this.fullrect.width + ', original width=' + this.oriFullrect.width);
            this.fullrect = Object.assign(this.fullrect, this.oriFullrect);
            let img = this.domElement.lastElementChild;
            let imgRatio = undefined;
            let plhRatio = undefined;
            if (img.naturalHeight > 0) {
                imgRatio = img.naturalWidth / img.naturalHeight;
            } else {
                imgRatio = 1;
            }
            // Because of the placeholder border, a correction of the double of the border width is necessary
            let borderCorrector =  4 / this.parentPlaceholders.parentImgContainer.magFactor;
            let correctedRect = {
                width: this.fullrect.width - borderCorrector,
                height: this.fullrect.height - borderCorrector
            }
           if (correctedRect.height > 0) {
               plhRatio = correctedRect.width / correctedRect.height;
           } else {
               plhRatio = 1;
           }
           if (imgRatio <= plhRatio) {
                this.fullrect.width = correctedRect.height * imgRatio + borderCorrector;
           } else {
               this.fullrect.height = correctedRect.width / imgRatio + borderCorrector;
           }
        }
    }
}

class QuestionPlaceholder extends Placeholder {
    /**
     * 
     * @param {string} id All placeholders are numbered in the order of their creation and get an id '<editor id>_plh<nr>'
     * @param {string} type Content of placeholder. One of 'plhImgT', 'plhTxtT'
     * @param {obj} fullRect Full description of the placeholder rectangle in intrinsic coordinates
     */
     constructor(parentPlaceholders, id, type, fullrect) {       
        super(parentPlaceholders, id, type, fullrect);
        if (this.type == plhImgT) {
            this.domElement.className = 'imedQuestionPlaceholderImg';
            this.domElement.addEventListener('drop', this.boundPlaceholderDropH);
            this.domElement.addEventListener('dragstart', this.boundPlaceholderDragstartH);
        } else if (this.type == plhTxtT) {
            this.domElement.className = 'imedQuestionPlaceholderTxt';
        } else {
            throw new new Error('Unimplemented question placeholder type');
        }        
    }
    imgLoadH() {
        this.shrinkToImg();
        let magFactor = this.parentPlaceholders.parentImgContainer.magFactor;
        this.applyGeometry(magFactor);
    }
    boundImgLoadH = this.imgLoadH.bind(this);
    /**
     * Drops the clone of an image, taking the original from the gallery
     * The data in dataTransfer is the src attribute in the gallery.
     * Any preexisting children, are removed from the placeholder, so that dropping on an existing image
     * results in a replacement. If the image cannot be taken by src from the gallery a warning alert is issued
     * 
     * @param {obj} e 
     */
    placeholderDropH(e) {
        let data = e.dataTransfer.getData('text/plain');
        let gallery = this.parentPlaceholders.parentImgContainer.parentClass.gallery;
        // Only gallery images are allowed for students
        let img = gallery.getImgByName(data);
        if (img) {
            let clone = img.cloneNode();
            clone.className = 'imedIsPlaceholderImg';
            clone.addEventListener('load', this.boundImgLoadH);
            this.domElement.className = 'imedEmptyPlaceholderImg';
            // Remove possible preexistent children
            while (this.domElement.lastElementChild) {
                this.domElement.removeChild(this.domElement.lastElementChild);
            }
            this.domElement.appendChild(clone);
            /* Had to be moved to this.imgLoadHandler, because otherwise it is executed before clone is completely attatched and loaded
            this.shrinkToImg();
            let magFactor = this.parentPlaceholders.parentImgContainer.magFactor;
            this.applyGeometry(magFactor);
            */
            e.preventDefault();
            console.log('Drop on placeholder data = ', data);
        } else {
            alert('Only gallery images are allowed');
        }
    }
    boundPlaceholderDropH = this.placeholderDropH.bind(this)
    placeholderDragstartH(e) {
        let data = this.id;
        e.dataTransfer.setData('text/plain', data);
        console.log('question placeholder dragstart ', data);
    }
    boundPlaceholderDragstartH = this.placeholderDragstartH.bind(this)
}

class SolutionPlaceholder extends Placeholder {
    /**
     * 
     * @param {string} id All placeholders are numbered in the order of their creation and get an id '<editor id>_plh<nr>'
     * @param {string} type Content of placeholder. One of 'plhImgT', 'plhTxtT'
     * @param {obj} fullRect Full description of the placeholder rectangle in intrinsic coordinates
     */
     constructor(parentPlaceholders, id, type, fullrect) {       
        super(parentPlaceholders, id, type, fullrect);
        // Save the original placeholder dimensions
        this.oriFullrect = this.clone(fullrect);
        if (this.type == plhImgT) {
            this.domElement.className = 'imedRightPlhImg';
        } else if (this.type == plhTxtT) {
            this.domElement.className = 'imedRightPlhTxt';
        } else {
            throw new new Error('Unimplemented question placeholder type');
        }        
    }
}

class AnswerPlaceholder extends Placeholder {
    /**
     * 
     * @param {string} id All placeholders are numbered in the order of their creation and get an id '<editor id>_plh<nr>'
     * @param {string} type Content of placeholder. One of 'plhImgT', 'plhTxtT'
     * @param {obj} fullRect Full description of the placeholder rectangle in intrinsic coordinates
     * @param {integer} 1, 0 or -1 depending on wether the placeholder was corrected as right, no answer, wrong. Can be undefined
     */
     constructor(parentPlaceholders, id, type, fullrect, evaluation) {       
        super(parentPlaceholders, id, type, fullrect);
        this.eval = evaluation;
        // Save the original placeholder dimensions
        this.oriFullrect = this.clone(fullrect);
        if (this.type == plhImgT) {
            this.domElement.className = this.evalClass() + 'Img';
        } else if (this.type == plhTxtT) {
            this.domElement.className = this.evalClass() + 'Txt';
        } else {
            throw new new Error('Unimplemented question placeholder type');
        }        
    }
    evalClass() {
        if (this.eval !== undefined) {
            switch (this.eval) {
                case 1:
                    return 'imedRightPlh';
                case -1:
                    return 'imedWrongPlh';
                case 0:
                    return 'imedNoAnsPlh';
            }
        } 
        return 'imedAnsPlh';
    }
}

/**
 * Each Placeholder has properties for an abstract description
 * - id a string allowing to identify a particular Placeholder within a set of this 
 * - fullrect an object describing a rectangle in an abstract way. rect itself consists of properties
 *      - left
 *      - top
 *      - width
 *      - height
 *   expressed in intrinsic coordinates, which must be transformed homothetically for representation
 * The representation is done by multiplying the intrinsic coordinates by imgContainer.magFactor 
 * which is the ratio between the actual container height and the original height,
 * which was the natural height of the loaded image
 */
class EditorPlaceholder extends Placeholder {
    /**
     * 
     * @param {string} id All placeholders are numbered in the order of their creation and get an id '<editor id>_plh<nr>'
     * @param {string} type Content of placeholder. One of 'plhImgT', 'plhTxtT'
     * @param {obj} fullRect Full description of the placeholder rectangle in intrinsic coordinates
     */
    constructor(parentPlaceholders, id, type, fullRect) {       
        super(parentPlaceholders, id, type, fullRect);
        if (this.type == plhImgT) {
            this.domElement.className = 'imedEditorPlaceholderImg';
            this.domElement.addEventListener('drop', this.boundPlaceholderDropH);
        } else if (this.type == plhTxtT) {
            this.domElement.className = 'imedEditorPlaceholderTxt';
        } else {
            throw new new Error('Unimplemented editor placeholder type');
        }   
    }
    adjustDimensions(position, xDelta, yDelta) {        
        switch (position) {
            case 'center':
                this.fullrect.left += xDelta;
                this.fullrect.top += yDelta;
                break;
            case 'bottom':
                this.fullrect.height += yDelta;
                break;
            case 'right':
                this.fullrect.width += xDelta;
                break;
            case 'top':
                this.fullrect.top += yDelta;
                this.fullrect.height -= yDelta;
                break;
            case 'left':
                this.fullrect.left += xDelta;
                this.fullrect.width -= xDelta;
                break;
        }
        // Avoid making the placeholder too small
        this.setMinima();
        this.applyGeometry(this.parentPlaceholders.parentImgContainer.magFactor);
    }
    adjustRectangle(height, width) {
        this.fullrect.height = height;
        this.fullrect.width = width;
        this.applyGeometry(this.parentPlaceholders.parentImgContainer.magFactor);
    }
    async placeholderDropH(e) {
        e.preventDefault();
        // console.log('Drop on placeholder ' + e.target.id);
        // e.stopPropagation();
        let files = e.dataTransfer.files;
        if (files.length == 1) {
            // files[0] is the only file to upload
            // console.log('One file dropped. name=' + files[0].name + '. size=' + files[0].size);
            let result = await uploadImg('axchange.php', sessname, 'fileToUpload', files[0], files[0].name);            
            if (result.errmess == '') {
                try {                    
                    let img = await getImg('hashedImages/' + result.imgServerName);
                    img.className = 'imedIsPlaceholderImg';
                    // Remove possible preexistent children
                    while (this.domElement.lastElementChild) {
                        this.domElement.removeChild(this.domElement.lastElementChild);
                    }
                    // Set special dragstart for img, thus disabling the built in dragstart for images
                    img.addEventListener('dragstart', uImgDragstartH);
                    this.domElement.appendChild(img);
                } catch(errMsg) {
                    alert(errMsg);
                }
            } else {
                alert(result.errmess); 
            }
        } else {
            // We drop internally
            let data = e.dataTransfer.getData('text/plain');
            console.log('Internal drop ' + data);
            let img = undefined;
            // Check if it is a placeholder image
            img = this.parentPlaceholders.getImgByName(data);
            if (!img) {
                // It is not a placeholder image. Check if it is a gallery image
                img = this.parentPlaceholders.parentImgContainer.parentClass.gallery.getImgByName(data);
            }
            if (img) {
                let clone = img.cloneNode();
                clone.className = 'imedIsPlaceholderImg';
                // Remove possible preexistent children
                while (this.domElement.lastElementChild) {
                    this.domElement.removeChild(this.domElement.lastElementChild);
                }
                this.domElement.appendChild(clone);
            }
        }
    }
    boundPlaceholderDropH = this.placeholderDropH.bind(this)
    imgDragoverH(e) {
        e.preventDefault();
    }
    // No bound version required
    imgDragstartH(e) {
        if (this.type == plhImgT && this.domElement.lastElementChild) {
            console.log('Dragstart on image ' + this.domElement.lastElementChild.src);
            e.dataTransfer.setData('text/plain', this.domElement.lastElementChild.src);
        }
    }
    boundImgDragstartH = this.imgDragstartH.bind(this)
}

class IsGallery {
    constructor (parentIsImg, height, width) {
        this.parentIsImg = parentIsImg;
        this.height = height; // The height of the workspace <div>
        this.width = width; // The width of the workspace <div>
        this.globalDivNode = document.getElementById(this.parentIsImg.id); // The <div> that holds the Whole editor
        this.imgContainer = document.createElement('div');
        this.imgContainer.className = 'imedIsGallery';
        this.imgContainer.style.width = this.width + 'px';
        this.globalDivNode.appendChild(this.imgContainer);
    }
    representation() {
        let rep = [];
        for (let i=0; i < this.imgContainer.children.length; i++) {
            let img = this.imgContainer.children[i];
            console.log('gallery img ', img.src);
            rep.push(img.src.split('/').pop());
        }
        return rep;
    }
    getImgByName(name) {
        for (let i = 0; i < this.imgContainer.children.length; i++) {
            if (this.imgContainer.children[i].src == name) {
                return this.imgContainer.children[i];
            }
        }
    }
    galImgDragstartH(e) {
        console.log('gallery image dragstart ' + e.target.src);
        e.dataTransfer.setData('text/plain', e.target.src);
    }
    boundGalImgDragstartH = this.galImgDragstartH.bind(this);
}

class IsQuestionGallery extends IsGallery {
    constructor (parentIsImg, height, width) {
        super(parentIsImg, height, width);
        this.imgContainer.addEventListener('drop', this.boundGalleryDropH);
        this.imgContainer.addEventListener('dragover', (e) => {e.preventDefault(); e.stopPropagation()});
    }
    async loadImages(images) {
        for (let imgName of images) {
            // console.log('going to load ' + imgName);
            try {
                let img = await getImg('hashedImages/' + imgName);
                img.className = 'imedGalleryImage';
                img.addEventListener('dragstart', this.boundGalImgDragstartH);
                this.imgContainer.appendChild(img);
            } catch(err) {
                console.log(err);
            }
        }
    }
    galleryDropH(e) {
        // Accept only internal drops
        e.preventDefault();
        let data = e.dataTransfer.getData('text/plain');
        console.log('question gallery drop', data);
        this.parentIsImg.imgContainer.placeholders.removeImg(data);
    }
    boundGalleryDropH = this.galleryDropH.bind(this);
}

class IsEditorGallery extends IsGallery {
    constructor (parentIsImg, height, width) {
        super(parentIsImg, height, width);
        this.imgContainer.addEventListener('dragover', (e) => e.preventDefault());
        this.imgContainer.addEventListener('drop', this.boundGalleryDropH);
    }
    async galleryDropH(e) {
        e.preventDefault();
        console.log('Drop on editor gallery ', e.dataTransfer);
        // e.stopPropagation();
        let files = e.dataTransfer.files;
        if (files.length == 1) {
            // files[0] is the only file to upload
            console.log('One file dropped. name=' + files[0].name + '. size=' + files[0].size);
            let result = await uploadImg('axchange.php', sessname, 'fileToUpload', files[0], files[0].name);            
            if (result.errmess == '') {
                try {                    
                    let img = await getImg('hashedImages/' + result.imgServerName);
                    img.className = 'imedGalleryImage';
                    console.log('Editor gallery external drop src=' + img.src);
                    this.imgContainer.appendChild(img);
                } catch(errMsg) {
                    alert(errMsg);
                }
            } else {
                alert(result.errmess); 
            }
        } else {
            // We drop internally
            let data = e.dataTransfer.getData('text/plain');
            console.log('Editor gallery internal drop ' + data);
            let decoded = decodeImgData(data);
            let img = this.parentIsImg.imgContainer.placeholders.getImgByPlaceholderId(decoded.id);
            if (img) {
                let clone = img.cloneNode();
                clone.className = 'imedGalleryImage';
                this.imgContainer.appendChild(clone);
            }
        }
    }
    boundGalleryDropH = this.galleryDropH.bind(this)
    async loadGallery(images) {
        for (let image of images) {             
            let img = await getImg('hashedImages/' + image);
            img.className = 'imedGalleryImage';
            this.imgContainer.appendChild(img);
        }
    }
    galleryMouseoverH(e) {
        // console.log('gallery mouseover target ' + e.target + ' related target ' + e.relatedTarget);
        if (e.target !== this.imgContainer) {
            // console.log('image ' + e.target.src.split('/').pop());
            e.target.style.cursor = 'pointer';
        } else {
            e.target.style.cursor = '';
        }
    }
    boundGalleryMouseoverH = this.galleryMouseoverH.bind(this);
    galleryDelClickH(e) {
        if (e.target.tagName == 'IMG') {
            // Remove the image from DOM without removing it on the server
            this.imgContainer.removeChild(e.target);
        }
    }
    boundGalleryDelClickH = this.galleryDelClickH.bind(this);
}

/**
 * Base class for IsImgEditor and IsImgQuestion. It is configured by 'paramsJson' which is a json string for the object
 * {
 *      id: <the id for the div node holding the editor part built by java script>
 *      height: <the height of the workspace in pixels>
 *      width: <the width of the workspace in pixels>
 *      plHeight: <the height of placeholders in pixels>
 *      plWidth: <the width of placeholders in pixels>
 *      sessname: <the name of the session>
 * }
 * Other properties may be present, for use by children of IsImg
 */
class IsImg {
    constructor (paramsJson) {
        let params = JSON.parse(paramsJson);
        this.id = params.id; // The id of the <div> that will hold the whole image editor
        console.log('id of globalDivNode ' + this.id);
        this.globalDivNode = document.getElementById(this.id); // The <div> that holds the Whole editor
        sessname = params.sessname; // Note that sessname is a module variable, not an IsImg property
        this.submitButtons = params.submitButtons;
        // console.log('document clientHeight ' +document.documentElement.clientHeight)
        if (params?.height && params.height > 0) {
            this.height = params.height; // The height of the workspace <div>. Does not include the gallery
         } else {
             // Use half the available height
            this.height = document.documentElement.clientHeight * 0.5;
         }
         // console.log('IsImg constructor height ' + this.height);
         if (params?.width && params.width > 0) {
            this.width = params.width; // The width of the workspace <div>
         } else {
            let mainList = document.getElementsByTagName('MAIN');
            if (mainList) {
               this.width = this.globalDivNode.clientWidth;
            } else {
                this.width = document.documentElement.clientWidth * 0.5;
            }
         }
        this.plhHeight = params.plhHeight; // Default placeholder height in pixels. 
        // The transform to intrinsic coordinates is made, when applied, so it will depend on the magFactor at time of application
        this.plhWidth = params.plhWidth; // Default placeholder width in pixels
        // Both isImgEditor and isImgQuestion will hold an imgContainer, but create it at different moments
        this.currentMode = undefined;
        this.imgContainer = undefined;    
        this.gallery = undefined; // Will be defined by children
        this.resizing = undefined; // Applies only to global resizing of the whole image and its content
    }
    init(representationJson) {        
        console.log(representationJson);
        let rep = JSON.parse(representationJson);
        // Prepend the global id to the placeholder id's
        if (rep?.imgContainer?.placeholders) {
            for (let plh of rep.imgContainer.placeholders) {
                plh.id = this.id + '_' + plh.id;
            }
        }
        this.loadedRep = rep;
    }
    replaceSubmitButtons(submitButtons) {
        if (submitButtons) {
            for (let submitButton of submitButtons) {
                let replacedDomnodes = document.getElementsByName(submitButton);
                if (replacedDomnodes && replacedDomnodes.length > 0) { 
                    let clickHandler = function(e) { 
                        let formNode = e.target.form; 
                        // Create a POST for the name of the clicked button          
                        let actpost = document.createElement('input');
                        actpost.name = submitButton;
                        actpost.value = submitButton;
                        actpost.type = 'hidden';
                        formNode.appendChild(actpost);
                        formNode.submit();
                        // Create a post variable imedJson for the description of the submitted image editor content
                        let hiddenInput = document.createElement('input');
                        hiddenInput.type = 'hidden';
                        hiddenInput.name = 'imedJson';
                        hiddenInput.value = JSON.stringify(this.representation());
                        formNode.appendChild(hiddenInput);
                        formNode.submit();
                    }
                    let boundClickHandler = clickHandler.bind(this);            
                    let replacementButton = document.createElement("input");
                    replacementButton.addEventListener('click', boundClickHandler);
                    replacementButton.name = replacedDomnodes[0].name;
                    replacementButton.className = 'button';
                    replacementButton.type = 'button';
                    replacementButton.value = replacedDomnodes[0].value;
                    for (let i = 0; i < replacedDomnodes.length; i++) {
                        if (i > 0) {
                            replacementButton = replacementButton.cloneNode(true);
                            replacementButton.addEventListener('click', boundClickHandler);
                        }
                        replacedDomnodes[i].replaceWith(replacementButton);
                    }
                }
            }
        }
    }
    workspaceMousemoveH(e) {
        let mousePos = relMousePos(e); // Workspace relative mouse position
        if (this.imgContainer.resizing) {
            let mouseRatio = undefined;
            let height = undefined;
            let width = undefined
            if (mousePos.y == 0) {
                mouseRatio = 1;
            } else {
                mouseRatio = mousePos.x / mousePos.y;
            }
            if (mouseRatio > this.imgContainer.ratio) {
                // Adjust width
                width = mousePos.x;
                height = width / this.imgContainer.ratio;
            } else {
                // Adjust height
                height = mousePos.y; 
                width = height * this.imgContainer.ratio;
            } 
            this.imgContainer.magFactor = height / this.imgContainer.height;
            this.imgContainer.applyGeometry();
        } else {
            // The cursor is not changed during resize
            let newCursor = this.imgContainer.borderCursor(mousePos);
            if (newCursor != this.workspace.style.cursor) {
                this.workspace.style.cursor = newCursor
            }
        }
    }
    boundWorkspaceMousemoveH = this.workspaceMousemoveH.bind(this)
    workspaceMousedownH(e) {
        let mousePos = relMousePos(e); // Workspace relative mouse position
        let cursor = this.imgContainer.borderCursor(mousePos); // If mouse position is neither right nor bottom, an empty string is returned
        if (cursor != '' && e.buttons == 1) {
            this.imgContainer.resizing = true;
        }
    }
    boundWorkspaceMousedownH = this.workspaceMousedownH.bind(this)
    workspaceMouseupH(e) {
       this.imgContainer.resizing = false;
    }
    boundWorkspaceMouseupH = this.workspaceMouseupH.bind(this)
    workspaceMouseleaveH(e) {
        this.imgContainer.resizing = false;
    }
    boundWorkspaceMouseleaveH = this.workspaceMouseleaveH.bind(this)
    representation() {
        let imgContainerRep;
        if (this.imgContainer) {
            imgContainerRep = this.imgContainer.representation();
        }
        let galleryRep;
        if (this.gallery) {
            galleryRep = this.gallery.representation();
        }
        return {
            origin: this.constructor.name,
            imgContainer: imgContainerRep,
            gallery: galleryRep
        }
    }
}
        
/**
 * Used to create and to change the question
 */
class IsImgEditor extends IsImg {
    constructor(paramsJson) {
        super(paramsJson);  
        this.workspace = document.createElement('div');
        this.workspace.className = 'imedEditorWorkspace'
        this.workspace.style.height = this.height + 'px';
        this.workspace.style.width = this.width + 'px';
        // Dropping an external image on the workspace opens a new tab, displaying the image.
        // This is annoying, when you just miss the placeholder on which yo want to drop the image.
        // A drop handler looks like a solution, but works only if the dragover is prevented.
        this.workspace.addEventListener('drop', (e) => {e.preventDefault(); e.stopPropagation()});
        this.workspace.addEventListener('dragover', (e) => {e.preventDefault(); e.stopPropagation()});
    }
    cmdButtons() {
        return [
            button("stdDim", imagesDir + "isFullParent.png", "Standard size"),
            button("oriDim",  imagesDir + "isOriginalImg.png", "Original size"),
            button("areaChoice",  imagesDir + "isAreaChoice.png", "Fix target area"),
            button("syncDims",  imagesDir + "isSyncDims.png", "Sync image targets"),
            button("areaTxt",  imagesDir + "isAreaTxt.png", "TextArea"),
            button("areaDelete",  imagesDir + "isAreaDelete.png", "Delete"),
            // button("store", "/isImg/isArrowStore.png", "Store")
        ]

        function button(id, src, title) {
            let img = document.createElement('img');
            img.id = id;
            img.src = src;
            img.title = title;
            img.className = 'imedMyIcon';
            return img;
        }
    }
    areaChoiceClickH(e) {
        if (this.currentMode == areaChoiceM) {
            this.setMode(resizeM);
        } else {
            if (this.imgContainer) {
                this.setMode(areaChoiceM);
            } else {
                alert('No image loaded');
            }
        }
    }
    boundAreaChoiceClickH = this.areaChoiceClickH.bind(this)
    syncDimsClickH(e) {
        if (this.currentMode == syncDimsM) {
            this.setMode(resizeM);
        } else {
            if (this.imgContainer) {
                this.setMode(syncDimsM);
            } else {
                alert('No image loaded');
            }
        }

    }
    boundSyncDimsClickH = this.syncDimsClickH.bind(this);
    areaTxtClickH(e) {
        if (this.currentMode == areaTxtM) {
            this.setMode(resizeM);
        } else {
            if (this.imgContainer) {
                this.setMode(areaTxtM);
            } else {
                alert('No image loaded');
            }
        }

    }        
    boundAreaTxtClickH = this.areaTxtClickH.bind(this)
    areaDeleteClickH(e) {
        if (this.currentMode == areaDeleteM) {
            this.setMode(resizeM);
        } else {
            if (this.imgContainer?.placeholders?.items.length > 0) {
                this.setMode(areaDeleteM);
            } else {
                alert('No target set');
            }
        }
    }
    boundAreaDeleteClickH = this.areaDeleteClickH.bind(this)

    /**
     * Drops the main image on the workspace
     * 
     * @param {obj} e 
     */
    async workspaceDropH(e) {        
        // console.log('workspaceDropH fired');
        e.preventDefault();
        e.stopPropagation();
        let files = e.dataTransfer.files;
        if (files.length == 1) {
            // files[0] is the only file to upload
            // console.log('One file dropped. name=' + files[0].name + '. size=' + files[0].size);
            // uploadFile('upload.php', 'fileToUpload', files[0], files[0].name)
            let result = await uploadImg('axchange.php', sessname, 'fileToUpload', files[0], files[0].name);
            console.log(result);
            if (result) {
                if (result.errmess == '') {
                    try {
                        let img = await getImg('hashedImages/' + result.imgServerName);
                        // The main image is not draggable to prevent a confusion with draggable placeholder images
                        img.draggable = false;
                        // Set magFactor = 1 for new images
                        this.imgContainer = new EditorImgContainer(this, img, 1, result.imgServerName);
                        this.workspace.appendChild(this.imgContainer.container);
                        this.setMode(resizeM);
                    } catch(errMsg) {
                        alert(errMsg);
                    }
                } else {
                    alert(result.errmess); 
                }
            } else {
                alert('No response to image upload attempt');
            }
        }
    }
    boundWorkspaceDropH = this.workspaceDropH.bind(this)
    stdDimBclickH(e) {
        let workspaceRatio = parseInt(this.width) / parseInt(this.height);
        let stdWidth = undefined;
        let stdHeight = undefined;
        if (this.imgContainer.ratio > workspaceRatio) {
            // Wide image. Limit the width and compute the height
            stdWidth = parseInt(this.width);
            stdHeight = stdWidth / this.imgContainer.ratio;
        } else {
            // High image
            stdHeight = parseInt(this.height);
            stdWidth = stdHeight * this.imgContainer.ratio; 
        }
        this.imgContainer.magFactor = stdHeight / this.imgContainer.height;
        this.imgContainer.applyGeometry();
    }
    boundStdDimBclickH = this.stdDimBclickH.bind(this)
    oriDimBclickH(e) {
        this.imgContainer.magFactor = 1;
        this.imgContainer.applyGeometry();
    }
    boundOriDimBclickH = this.oriDimBclickH.bind(this);S
    setMode(mode) {
        if (this.currentMode != mode) {
            // disable this.currentMode)
            switch (this.currentMode) {
                case undefined:
                    break; // This is needed only at the very beginning
                case dropM:
                    this.workspace.removeEventListener('drop', this.boundWorkspaceDropH);
                    break;
                case resizeM:
                    // console.log('Remve listeners: workspaceMousedownH, workspaceMouseupH, workspaceMousemoveH, workspaceMouseleaveH')
                    this.workspace.removeEventListener('mousedown', this.boundWorkspaceMousedownH);
                    this.workspace.removeEventListener('mouseup', this.boundWorkspaceMouseupH);
                    this.workspace.removeEventListener('mousemove', this.boundWorkspaceMousemoveH);
                    this.workspace.removeEventListener('mouseleave', this.boundWorkspaceMouseleaveH);
                    // Add click handlers to standard dimension and original dimension buttons
                    let stdDimB = document.getElementById('stdDim');
                    stdDimB.removeEventListener('click', this.boundStdDimBclickH);
                    let oriDimB = document.getElementById('oriDim');
                    oriDimB.removeEventListener('click', this.boundOriDimBclickH);
                    this.imgContainer.placeholders.disableTextareas(false); // Enable possible textareas in placeholders
                    this.imgContainer.container.removeEventListener('mousedown', this.imgContainer.placeholders.boundPlaceholderMousedownH);
                    this.imgContainer.container.removeEventListener('mouseup', this.imgContainer.placeholders.boundPlaceholderMouseupH);
                    this.imgContainer.container.removeEventListener('mousemove', this.imgContainer.placeholders.boundPlaceholderMousemoveH);
                    this.imgContainer.placeholders.terminateResizing(); // This should not be necessary. It is just a security measure
                    break;
                case areaChoiceM:
                    // console.log('Remove Listeners; canvasMousedownH, canvasMouseupHandler, canvasMousemoveH');
                    let areaChoiceB = document.getElementById('areaChoice');
                    areaChoiceB.classList.remove('imedActiveIcon');
                    this.imgContainer.canvas.removeEventListener('mousedown', this.imgContainer.boundCanvasMousedownH);
                    this.imgContainer.canvas.removeEventListener('mouseup', this.imgContainer.boundCanvasMouseupH);
                    this.imgContainer.canvas.removeEventListener('mousemove', this.imgContainer.boundCanvasMousemoveH);
                    this.imgContainer.canvas.removeEventListener('mouseout', this.imgContainer.boundCanvasMouseoutH);
                    break;
                case areaTxtM:
                    // console.log('Remove Listeners; canvasMousedownH, canvasMouseupHandler, canvasMousemoveH');
                    let areaTxtB = document.getElementById('areaTxt');
                    areaTxtB.classList.remove('imedActiveIcon');
                    this.imgContainer.canvas.removeEventListener('mousedown', this.imgContainer.boundCanvasMousedownH);
                    this.imgContainer.canvas.removeEventListener('mouseup', this.imgContainer.boundCanvasMouseupH);
                    this.imgContainer.canvas.removeEventListener('mousemove', this.imgContainer.boundCanvasMousemoveH);
                    break;
                case areaDeleteM:
                    let areaDeleteB = document.getElementById('areaDelete');
                    areaDeleteB.classList.remove('imedActiveIcon');
                    this.imgContainer.placeholders.removePlaceholderDeleteListeners();
                    this.gallery.imgContainer.removeEventListener('mouseover', this.gallery.boundGalleryMouseoverH);
                    this.gallery.imgContainer.removeEventListener('click', this.gallery.boundGalleryDelClickH);
                    break;
                case syncDimsM:
                    let syncDimsB = document.getElementById('syncDims');
                    syncDimsB.classList.remove('imedActiveIcon');
                    this.imgContainer.container.removeEventListener('mousemove', this.imgContainer.placeholders.boundSyncDimsMousemoveH);
                    this.imgContainer.container.removeEventListener('mousedown', this.imgContainer.placeholders.boundSyncDimsMousedownH);
                    this.imgContainer.container.removeEventListener('mouseup', this.imgContainer.placeholders.boundSyncDimsMouseupH);
                    this.imgContainer.placeholders.terminateResizing(); // This should not be necessary. It is just a security measure
                    break;
                default:
                    console.log ('Unimplemented mode ' + this.currentMode);
                    throw new Error('Unimplemented mode ' +this.currentMode);
            }
            this.currentMode = mode;
            // enable new mode
            switch (mode) {
                case dropM:
                    // Add a drop handler
                    this.workspace.addEventListener('drop', this.boundWorkspaceDropH); 
                    // this.imgContainer.placeholders.makeImgDraggable(false);
                    break;
                case resizeM:                   
                    this.workspace.addEventListener('mousedown', this.boundWorkspaceMousedownH);
                    this.workspace.addEventListener('mouseup', this.boundWorkspaceMouseupH);
                    this.workspace.addEventListener('mousemove', this.boundWorkspaceMousemoveH);
                    this.workspace.addEventListener('mouseleave', this.boundWorkspaceMouseleaveH);
                    // Add click handlers to standard dimension and original dimension buttons
                    let stdDimB = document.getElementById('stdDim');
                    stdDimB.addEventListener('click', this.boundStdDimBclickH);
                    let oriDimB = document.getElementById('oriDim');
                    oriDimB.addEventListener('click', this.boundOriDimBclickH);
                    // Resizing of placeholders cannot be handled entirely on placeholder level
                    // because the mouse can be outside of the placeholder, if the movement is fast enough
                    this.imgContainer.placeholders.disableTextareas(true);
                    this.imgContainer.container.addEventListener('mousedown', this.imgContainer.placeholders.boundPlaceholderMousedownH);
                    this.imgContainer.container.addEventListener('mouseup', this.imgContainer.placeholders.boundPlaceholderMouseupH);
                    this.imgContainer.container.addEventListener('mousemove', this.imgContainer.placeholders.boundPlaceholderMousemoveH);
                    // this.imgContainer.placeholders.makeImgDraggable(false);
                    break;
                case areaChoiceM:
                    let areaChoiceB = document.getElementById('areaChoice');
                    areaChoiceB.classList.add('imedActiveIcon');
                    this.imgContainer.canvas.addEventListener('mousedown', this.imgContainer.boundCanvasMousedownH);
                    this.imgContainer.canvas.addEventListener('mouseup', this.imgContainer.boundCanvasMouseupH);
                    this.imgContainer.canvas.addEventListener('mousemove', this.imgContainer.boundCanvasMousemoveH);
                    this.imgContainer.canvas.addEventListener('mouseout', this.imgContainer.boundCanvasMouseoutH);
                    this.imgContainer.placeholders.attatchDraggingHandlers();
                    // this.imgContainer.placeholders.makeImgDraggable(true);
                    break;
                case areaTxtM:
                    let areaTxtB = document.getElementById('areaTxt');
                    areaTxtB.classList.add('imedActiveIcon');
                    this.imgContainer.canvas.addEventListener('mousedown', this.imgContainer.boundCanvasMousedownH);
                    this.imgContainer.canvas.addEventListener('mouseup', this.imgContainer.boundCanvasMouseupH);
                    this.imgContainer.canvas.addEventListener('mousemove', this.imgContainer.boundCanvasMousemoveH);
                    // this.imgContainer.placeholders.makeImgDraggable(false);
                    break;
                case areaDeleteM:
                    let areaDeleteB = document.getElementById('areaDelete');
                    areaDeleteB.classList.add('imedActiveIcon');
                    this.imgContainer.placeholders.addPlaceholderDeleteListeners();
                    this.gallery.imgContainer.addEventListener('mouseover', this.gallery.boundGalleryMouseoverH);
                    this.gallery.imgContainer.addEventListener('click', this.gallery.boundGalleryDelClickH);
                    // this.imgContainer.placeholders.makeImgDraggable(false);
                    break;
                case syncDimsM:
                    let syncDimsB = document.getElementById('syncDims');
                    syncDimsB.classList.add('imedActiveIcon');
                    this.imgContainer.placeholders.defaultImgPlhRects();
                    this.imgContainer.container.addEventListener('mousemove', this.imgContainer.placeholders.boundSyncDimsMousemoveH);
                    this.imgContainer.container.addEventListener('mousedown', this.imgContainer.placeholders.boundSyncDimsMousedownH);
                    this.imgContainer.container.addEventListener('mouseup', this.imgContainer.placeholders.boundSyncDimsMouseupH);
                    break;
                default:
                    console.log ('Unimplemented mode ' + mode);
                    throw new Error('Unimplemented mode ' + mode);
            }
        }
    }
    /**
     * If both parameters are present, an existing base image is loaded from the server,
     * if none is defined, an empty image editor, prepared for the creation of a new base image is initialized,
     * if only one is defined, it is handled, as if none were defined.
     * 
     * @param {string} representationJson 
     */
    init(representationJson) { 
        super.init(representationJson);
        console.log(this.loadedRep);
        // Build up the div with the command buttons on top of the work area
        let headerDiv = document.createElement('div');
        headerDiv.className = 'imedIsImgEdHeader';
        let buttons = this.cmdButtons(); // array of <img> button nodes
        for (let button of buttons) {
            headerDiv.appendChild(button);
        }
        this.globalDivNode.appendChild(headerDiv);
        // Connect command button listeners
        let areaChoiceB = document.getElementById('areaChoice');
        areaChoiceB.addEventListener('click', this.boundAreaChoiceClickH);
        let syncDimsB = document.getElementById('syncDims');
        syncDimsB.addEventListener('click', this.boundSyncDimsClickH);
        let areaTxtB = document.getElementById('areaTxt');
        areaTxtB.addEventListener('click', this.boundAreaTxtClickH);
        let areaDeleteB = document.getElementById('areaDelete');
        areaDeleteB.addEventListener('click', this.boundAreaDeleteClickH);
        // Append workspace AFTER header
        this.globalDivNode.appendChild(this.workspace);
        this.gallery = new IsEditorGallery(this, this.height, this.width);
        if (!this.loadedRep.imgContainer) {
            this.setMode(dropM);
        } else {
            // Load the representation
            // let representation = await getJson('download.php', 'getRepresentation', representationId);
            this.loadImgContainer(this.loadedRep.imgContainer);
            this.gallery.loadGallery(this.loadedRep.gallery)
            let a = 1;
        }
    }
    /**
     * The json representation object looks like
     *
        {
           baseImage : <main image server name>
            height: <main image natural height>,
            width: <main image natural width>,
            ratio: <main image width / height ratio>,
            magFactor: <magnification factor from intrinsic to representation coordinates>
            placeholders: [
                {
                    type: this.type,
                    id: <unique integer>
                    content: this.content,
                    fullRect: fullrect = <object with top, left, height, width properties in intrinsic coordinates>
                },
                {
                    type: this.type,
                    id: this.id,
                    content: this.content,
                    fullRect: this.fullrect
                },
                {
                    type: this.type,
                    id: this.id,
                    content: this.content,
                    fullRect: this.fullrect
                }
            ]
        }
     * 
     * @param {obj} representation
     */
    async loadImgContainer(representation) {
        try {
            let img = await getImg('hashedImages/' + representation.baseImage);
            this.imgContainer = new EditorImgContainer(this, img, representation.magFactor, representation.baseImage);
            // Must be awaited, lest setMode would try to act on images, that are not yet loaded
            await this.imgContainer.placeholders.load(representation.placeholders);
            this.workspace.appendChild(this.imgContainer.container);
            this.imgContainer.applyGeometry();
            this.setMode(resizeM);
        } catch(error) {
            alert('loadImgContainer error: ' + error.message);
        }
    }
}

class IsImgQuestion extends IsImg {
    constructor(paramsJson){
        super(paramsJson);  
        this.workspace = document.createElement('div');
        this.workspace.className = 'imedQuestionWorkspace'
        this.workspace.style.height = this.height + 'px';
        this.workspace.style.width = this.width + 'px';
        // Dropping an external image on the workspace opens a new tab, displaying the image.
        // This is annoying, when you just miss the placeholder on which yo want to drop the image.
        // A drop handler looks like a solution, but works only if the dragover is prevented.
        this.workspace.addEventListener('drop', (e) => {e.preventDefault(); e.stopPropagation()});
        this.workspace.addEventListener('dragover', (e) => {e.preventDefault(); e.stopPropagation()});
    }
    init(representationJson) {
        super.init(representationJson);
        console.log(this.loadedRep);
        // Build up the workspace
        this.globalDivNode.appendChild(this.workspace);
        this.loadImgContainer(this.loadedRep);
        this.workspace.addEventListener('mousedown', this.boundWorkspaceMousedownH);
        this.workspace.addEventListener('mouseup', this.boundWorkspaceMouseupH);
        this.workspace.addEventListener('mousemove', this.boundWorkspaceMousemoveH);
        this.workspace.addEventListener('mouseleave', this.boundWorkspaceMouseleaveH);
        this.globalDivNode.appendChild(this.workspace);
        if (this.loadedRep.gallery.length > 0) {
            this.gallery = new IsQuestionGallery(this, this.height, this.width);
        }
    }
    async loadImgContainer(representation) {
        try {
            let imgContainer = representation.imgContainer;
            let img = await getImg('hashedImages/' + imgContainer.baseImage);
            // The main image is not draggable. This could lead to a confusion with draggable placeholder images
            img.draggable = false;
            this.imgContainer = new QuestionImgContainer(this, img, imgContainer.magFactor, imgContainer.baseImage);
            this.imgContainer.placeholders.load(imgContainer.placeholders);
            this.workspace.appendChild(this.imgContainer.container);
            this.imgContainer.applyGeometry();
            // Adjust workspace dimensions, if the workspace is taller than the image
            if (this.imgContainer.container.clientHeight < this.workspace.clientHeight) {
                let newHeight = this.imgContainer.container.clientHeight;
                this.workspace.style.height = newHeight + 'px';
            }
            if (representation?.gallery?.length > 0) {
                this.gallery.loadImages(representation.gallery);
            }
        } catch (errMsg) {
            alert(errMsg);
        }
    }
}

class IsImgSolution extends IsImg {
    constructor(paramsJson){
        super(paramsJson);  
        this.workspace = document.createElement('div');
        this.workspace.className = 'imedQuestionWorkspace'
        this.workspace.style.height = this.height + 'px';
        console.log('workspace height at construction ' + this.height);
        this.workspace.style.width = this.width + 'px';
    }
    init(representationJson) {
        super.init(representationJson);
        console.log(this.loadedRep);
        // Build up the workspace
        this.loadImgContainer(this.loadedRep.imgContainer);
        this.globalDivNode.appendChild(this.workspace);
    }
    async loadImgContainer(representation) {
        try {
            let img = await getImg('hashedImages/' + representation.baseImage);
            // The main image is not draggable. This could lead to a confusion with draggable placeholder images
            img.draggable = false;
            this.imgContainer = new SolutionImgContainer(this, img, representation.magFactor, representation.baseImage);
            this.imgContainer.placeholders.load(representation.placeholders);
            this.workspace.appendChild(this.imgContainer.container);
            this.imgContainer.applyGeometry();
            // Adjust workspace dimensions, if the workspace is taller than the image
            // console.log('img height ' + this.imgContainer.container.clientHeight + ' workspace height ' + this.workspace.clientHeight);
            // Adjust workspace dimensions, if the workspace is taller than the image
            if (this.imgContainer.container.clientHeight < this.workspace.clientHeight) {
                let newHeight = this.imgContainer.container.clientHeight;
                this.workspace.style.height = newHeight + 'px';
            }
        } catch (errMsg) {
            alert(errMsg);
        }
    }
}

class IsImgAnswer extends IsImg {
    constructor(paramsJson){
        super(paramsJson);  
        this.workspace = document.createElement('div');
        this.workspace.className = 'imedAnswerWorkspace'
        this.workspace.style.height = this.height + 'px';
        console.log('workspace height at construction ' + this.height);
        this.workspace.style.width = this.width + 'px';
    }
    init(representationJson) {
        super.init(representationJson);
        console.log(this.loadedRep);
        // Build up the workspace
        this.loadImgContainer(this.loadedRep.imgContainer);
        this.globalDivNode.appendChild(this.workspace);
    }
    async loadImgContainer(representation) {
        try {
            let img = await getImg('hashedImages/' + representation.baseImage);
            // The main image is not draggable. This could lead to a confusion with draggable placeholder images
            img.draggable = false;
            this.imgContainer = new AnswerImgContainer(this, img, representation.magFactor, representation.baseImage);
            this.imgContainer.placeholders.load(representation.placeholders);
            this.workspace.appendChild(this.imgContainer.container);
            this.imgContainer.applyGeometry();
            // Adjust workspace dimensions, if the workspace is taller than the image
            // console.log('img height ' + this.imgContainer.container.clientHeight + ' workspace height ' + this.workspace.clientHeight);
            // Adjust workspace dimensions, if the workspace is taller than the image
            if (this.imgContainer.container.clientHeight < this.workspace.clientHeight) {
                let newHeight = this.imgContainer.container.clientHeight;
                this.workspace.style.height = newHeight + 'px';
            }
        } catch (errMsg) {
            alert(errMsg);
        }
    }
}
