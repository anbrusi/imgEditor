<?php
/**
 * @abstract
 * Server side script for asynchronous interaction with an executing isTest JS script.
 * This script must be called as axchange.php from an executing JS script. 
 * The JS script must emulate (with fetch api as an instance) the submission of a form.
 * Parameters are passed by POST. Mandatory are the following POST parameters
 *      'sessname' the session name of the dispatching isTest session. It is the GET['s'] parameter in isTest2.
 *      'xcommand' one of the commands accepted by this script
 *      'jsonparams' a json string with the necessary parameters 
 * 
 * The response is a json encoded string. In case of error the property 'errmess' is an error message
 * 
 * @author A. Brunnschweiler
 * @version 08.4.2021 
 *          02.09.2021 Reduced standalone version. For isTest the complete session aware version is needed.
 */
class axchange {
    /**
     * DB connection parameters
     */
    const DB_DSN = 'mysql:host=localhost;dbname=iststch_img;charset=utf8';
    const DB_USER = 'iststch_user';
    const DB_PASS = 'iststch_user';
    /**
     * Error configuration
     */
    const ERR_SHOWERRORS = true;
    
    const CMD_UPLOAD_HASHED_IMAGE = 1;    

    const MAX_FILESIZE = 502400; // 1000kB
    const ALLOWED_EXTENSIONS = array('jpg', 'jpeg', 'png', 'gif');

    private static $pdoDB;

    function __construct() {    
        // Connect to the DB.   
	    self::$pdoDB = new PDO(self::DB_DSN, self::DB_USER, self::DB_PASS, array(	       
			PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
			PDO::ATTR_EMULATE_PREPARES => false,
			PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC
	    ));
    }
           
    /**
     * It is assumed, that if hash and original name are equal, the same image is referenced by the returned id in ThashedImages
     * The reverse is not true. The same images can have different (hash, oriName) pairs,
     * if for instannce they have been made with the same camera and have been named differently.
     * 
     * @param string $oriName
     * @param string $hash
     * @return mixed
     */
    private static function getIdByNameAndHash(string $oriName, $hash) {
        $stmt = self::$pdoDB->prepare('SELECT id FROM ThashedImages WHERE oriName=:oriName AND hash=:hash');
        $stmt->execute(array(':oriName' => $oriName,':hash' => $hash));
        return $stmt->fetchColumn();
    }

    /**
     * Builds an MD5 hash from the exif data of an image file at $imgPath
     * The fileName and fileDateTime cannot be used, since they refer to the upload name and time
     * It is assumed, that if the original name of an image file and this hash are equal for two image files,
     * the images are equal. This does not imply, that if two images are equal they have the same original file name and hash.
     * 
     * @param string $imgPath The full path to the image file, whose exif data are to be hashed
     * @return string|null If the exif information is not sufficient, null is returned
     */
    private static function getExifHash(string $imgPath) {        
        // Get hash
        try {
            $exifData = exif_read_data($imgPath);
            if ($exifData !== false) {
                // These two data are part of the upload, not of the immutable part of the image
                unset($exifData['FileName']);
                unset($exifData['FileDateTime']);
                // Check that we have sufficient data
                $exifHash = hash('md5', json_encode($exifData));
            } else {
                // $exifHash = null;
            }
        } catch (\Exception $ex) {
            $exifHash = null;
        }
        return $exifHash;
    }
    
    private static function getImgHash(string $imgPath) {
        try {
            $hash = hash('md5', file_get_contents($imgPath));
        } catch (\Exception $ex) {
            $hash = null;
        }
        return $hash;
    }
    
    /**
     * Uploads an image to the server
     * 
     * @param string $inputName the name of the input element of type file
     * @param string $hashImgPath document relative directory of the repository of image files pointed at by ThashedImages, ending with a '/'.
     * @return string $id The unique name of the image file in hashedImages
     */
    public function upload(string $inputName, string $hashImgPath) {
        $oriName = $_FILES[$inputName]['name'];
        $size = $_FILES[$inputName]['size'];
        if ($size > self::MAX_FILESIZE) {
            throw new \Exception('File with '.round($size / 1024).'M is too large');
        }
        $extension = strtolower(pathinfo($oriName, PATHINFO_EXTENSION));
        if (!in_array($extension, self::ALLOWED_EXTENSIONS)) {
            throw new \Exception('The extension of '.$oriname.' is not among allowed extensions');
        }
        $hash = self::getExifHash($_FILES[$inputName]['tmp_name']); // Can throw an exception
        if ($hash === null) {   
            $hash = self::getImgHash($_FILES[$inputName]['tmp_name']);
            if ($hash === null) {
                throw new \Exception('Cannot compute image hash');
            }
        }
        $id = self::getIdByNameAndHash($oriName, $hash);
        if ($id === false) {
            // The image has not yet been stored, so store a reference, to get the storage file name
            $sql = 'INSERT INTO ThashedImages SET oriName=:oriName, hash=:hash, multiplicity=:multiplicity';
            $stmt = self::$pdoDB->prepare($sql);
            $stmt->execute(array(':oriName' => $oriName, ':hash' => $hash, ':multiplicity' => 1));
            $id = self::$pdoDB->lastInsertId();
            $storageName = 'f_'.$id.'.'.$extension;
            // Physically store the file
            move_uploaded_file($_FILES[$inputName]['tmp_name'], $hashImgPath.$storageName); 
        } else {
            // The same image is present and has id $id, increase the multiplicity
            $sql = 'UPDATE ThashedImages SET multiplicity=multiplicity + 1 WHERE id=:id';
            $stmt = self::$pdoDB->prepare($sql);
            $stmt->execute(array(':id' => $id));
            $storageName = 'f_'.$id.'.'.$extension;
        }
        return $storageName;
    }

    /**
     * Emits a json string with properties 'imgServerName' and 'errmess'. One of them is empty
     * Tries to identify an image file, that has been just been uploaded and returns the name of the identified file, 
     * if a file has been identified or of a permanent copy of the uploaded file, if the identifiction failed.
     * In both cases the name of the file in hashedImages is returned as property 'imgServerName' of a json string.
     * If an error occurred it is returned as property 'errmess' in the json string.
     */
    private function uploadHashedImage() {        
        $imgServerName = $this->upload('fileToUpload', './hashedImages/'); // The id of the registration in ThashedImages
        $response = json_encode(array('imgServerName' => $imgServerName, 'errmess' => ''));
        ob_clean();
        echo $response;
    }
    
    public function dispatch() {
        if (!isset($_POST['jsonparams'])) {
            throw new \Exception('jsonparams missing');
        }
        $params = json_decode($_POST['jsonparams'], true);
        if ($params === null) {
            throw new \Exception('jsonparams cannot be decoded');
        }
        switch ($_POST['xcommand']) {
            case self::CMD_UPLOAD_HASHED_IMAGE:
                $this->uploadHashedImage(); // Emits a json string and dies. break is pleonastic
                break;
            default:
                throw new \Exception('Unknown command CMD_xx '.$_POST['xcommand']);
        }
    }
    
}
error_reporting(E_ALL);
function exception_error_handler($errno, $errstr, $errfile, $errline ) {
    throw new ErrorException($errstr, 0, $errno, $errfile, $errline);
}
set_error_handler("exception_error_handler");
function shutdownHandler() {
    $lastError = error_get_last();
    if ($lastError !== null) {
        $response = json_encode(array('errmess' => $lastError['message']));
        // Failing to clean the output buffer would send a standardized error message string before the wanted json
        ob_clean(); 
        echo $response;
    }
}
register_shutdown_function('shutdownHandler');
$axchange = new axchange();
$axchange->dispatch();
