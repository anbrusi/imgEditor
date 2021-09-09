'use strict'

/**
 * Returns an object with properties 'top', 'left', 'height', 'width', from
 * startPt and endPt, which are both objects with properties 'x' and 'y'
 * denoting the upper left and lower right corner of a rectangle.
 * startPt and endPt can be any of the two diagonal corners. Which is which is indifferent.
 * 
 * @param {obj} startPt 
 * @param {obj} endPt 
 */
export function stdRect(startPt, endPt) {
    let rect = {
        top: undefined,
        left: undefined,
        height: undefined,
        width: undefined
    }
    if (startPt.y <= endPt.y) {
        rect.top = startPt.y;
    } else {
        rect.top = endPt.y;
    }
    if (startPt.x <= endPt.x) {
        rect.left = startPt.x;
    } else  {
        rect.left = endPt.x;
    }
    rect.height = Math.abs(endPt.y - startPt.y);
    rect.width = Math.abs(endPt.x - startPt.x);
    return rect;
}

/**
 * Returns a string denoting the position of the point 'pt' within the rectangle 'rect'
 * The position is one of 'outside', 'top', 'bottom', 'left', 'right', 'resizecorner' (lower right corner), 'center'
 * 'borderWidth' is the width of the triggering border, which is reduced automatically for smaller rectangles,
 * so that the center stays at least one third of the rectangle
 * 
 * @param {obj} pt 
 * @param {obj} rect 
 * @param {obj} borderWidth 
 */
export function posInRect(pt, rect, borderWidth) {
    let horzBorder = borderWidth;
    if (horzBorder > rect.height / 3) {
        horzBorder = rect.height / 3;
    }
    let vertBorder = borderWidth;
    if (vertBorder > rect.width / 3) {
        vertBorder = rect.width / 3;
    }
    // console.log('vert border = ' + vertBorder);
    // Exclude the case where pt is not in rect
    if (pt.y < 0 || pt.y > rect.height || pt.x < 0 || pt.x > rect.width) {
        return 'outside';
    }
    // Position of pt within rect
    if (pt.y > rect.height - horzBorder && pt.x > rect.width - vertBorder) {
        return 'resizecorner';
    } else if (pt.y < horzBorder) {
        return 'top';
    } else if (pt.y > rect.height - horzBorder) {
        return 'bottom';
    } else if (pt.x < vertBorder) {
        return 'left';
    } else if (pt.x > rect.width - vertBorder) {
        return 'right';
    }  else {
        return 'center';
    }
}

/**
 * Returns a cursor name, of a cursor suitable to resize a rectangle, 
 * from a string 'posInRect', which charcterizes the position in a rectangle.
 * Typically 'posInRect is returned by the function posInRect of this module and can be also 'outside' 
 * if 'posInrect' is in the set of active positions 'activePositions' a suitable cursor name is returned.
 * 'posInRect' == 'outside' returns 'default, if 'outside is in the set of active positions
 * If 'posInRect' is not in the set of active positions, an empty string is returned
 * 
 * @param {string} posInRect 
 * @param {*} activePositions a set of those positions, which return a cursor
 */
export function resizeCursor(posInRect, activePositions) {
    if (!activePositions.has(posInRect)) {
        return '';
    }
    let cursor = undefined;
    switch (posInRect) {
        case 'resizecorner':
            cursor = 'nwse-resize';
            break;
        case 'top':
        case 'bottom':
            cursor = 'ns-resize';
            break;
        case 'left':
        case 'right':
            cursor = 'ew-resize';
            break;
        case 'center':
            cursor = 'grab';
            break;
        case'outside':
            cursor = 'default';
            break;
        default:
            cursor = 'default';
    }
    return cursor;
}