<?php
class ImgEditor {
    
    /**
     * DB connection parameters
     */
    const DB_DSN = 'mysql:host=localhost;dbname=iststch_img;charset=utf8';
    const DB_USER = 'iststch_user';
    const DB_PASS = 'iststch_user';

    private static $pdoDB;

    function __construct() {    
        // Connect to the DB.   
	    self::$pdoDB = new PDO(self::DB_DSN, self::DB_USER, self::DB_PASS, array(	       
			PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
			PDO::ATTR_EMULATE_PREPARES => false,
			PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC
	    ));
    }
    
    private function connectToDB() {
        $this->pdoDB = new \PDO(self::DB_DSN, self::DB_USER, self::DB_PASS);
        $this->pdoDB->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $this->pdoDB->setAttribute(\PDO::ATTR_EMULATE_PREPARES, false);
        $this->pdoDB->setAttribute(\PDO::ATTR_DEFAULT_FETCH_MODE, \PDO::FETCH_ASSOC);
    }

    private function header():string {
        $html = '';
        $html .= '<head>';
        $html .= '<meta charset="utf-8">';
        $html .= '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
        // Load CSS
        $html .= '<link rel="stylesheet" type="text/css" href="./index.css" media="screen" />';
        $html .= '</head>';
        return $html;
    }
    private function imageList():string {
        $html = '';
        // Display list of available images
        $html .= '<h2>Available images</h2>';
        $html .= '<form method="POST" action = "index.php">';
        $html .= '<ul>';
        $stmt = self::$pdoDB->prepare('SELECT id, name FROM Timgedreps');
        $stmt->execute();
        $images = $stmt->fetchAll();
        foreach ($images as $image) {
            $html .= '<li>';
            $html .= 'id="'.$image['id'].'" name="'.$image['name'].'" ';
            $html .= '<input type="submit" name="e_'.$image['id'].'" value="edit"> ';
            $html .= '<input type="submit" name="t_'.$image['id'].'" value="try out">';
            $html .= '</li>';
        }
        $html .= '</ul>';
        $html .= '<input type="submit" name="newImg" value="new image"/>';
        $html .= '<input type="hidden", name="available" value="available"/>';
        $html .= '</form>';
        return $html;
    }
    /**
     * Displays a page with an image editor for a new image
     */
    private function editNew():string {
        $html = '';
        // Prepare the editor for a new image
        $html .= '<form method="POST" action = "index.php">';
        $html .= '<label for "imgName">Image name: </label>';
        $html .= '<input type="text" name ="imgName" id="imgName" autofocus="autofocus"/>';
        $html .= '<div class="spacer"></div>';
        $html .= '<div id="isImgEd1"></div>';
        $html .= '<div class="spacer"></div>'; 
        // This is the original button. It will be replaced by JS. 
        $html .= '<input type="submit" class="button" name="store" value="Store">';
        $html .= '<input type="submit" class="button" name="escape" value="Escape">';

        // Init the editor in node isImgEd1
        $html .= ' <script type="module">';
            $html .= 'import  {isImedInstances} from "./modularJS/imgEditor.js"; ';
            $params = array('id' => 'isImgEd1', 'height' => 0, 'width' => 0,
                            'plhHeight' => 80, 'plhWidth' => 80, 'sessname' => 'snxxx' );
            $paramsJson = json_encode($params, true);
            $html .= 'let imgEditor = isImedInstances.create("IsImgEditor", "imgEditor", \''.$paramsJson.'\'); ';
            $initParams = array();
            $initParamsJson = json_encode($initParams, true);
            $html .= 'imgEditor.init(\''.$initParamsJson.'\'); ';
            $html .= 'imgEditor.replaceSubmitButtons(["store"]); ';
        $html .= '</script>';
        
        $html .= '</form>';
        return $html;
    }
    /*
    private function showQuestion(int $imgRepId):string {
        $html = '';
        $html .= '<h2>Question '.$imgRepId.'</h2>';
        $html .= '<form method="POST" action = "index.php">';
        // Prepare the editor for a new image
        $html .= '<div id="isImgQ1"></div>';
        // Init the editor in node isImgEd1
        $html .= ' <script async type="module">';
        $html .= 'import  {IsImgQuestion} from "./index.js"; ';
        $params = array('id' => 'isImgQ1', 'height' => 0, 'width' => 0, 'plhHeight' => 80, 'plhWidth' => 80,
                        'storeButtonId' => 'storeEditor', 'responseId' => "editorResponse");
        $paramsJson = json_encode($params, true);
        $html .= 'let imgQuestion = new IsImgQuestion(\''.$paramsJson.'\'); ';
        // Load an existing image
        $html .= 'imgQuestion.init('.$imgRepId.')';
        $html .= '</script>';
        // This is the button 
        $html .= '<input type="button" id="storeEditor" name="storeQuestion" value="store" class="isButton" />';
        $html .= '<input type="hidden" id="editorResponse" name="editorResponse" value="undefined" />';
        $html .= '</form>';
        return $html;
    }
    private function displayStudentAnswer(int $imgRepId):string {
        $html = '';
        $html .= '<h2>Answer</h2>';
        $html .= $_POST['editorResponse'];
        $html .= '<h2>Solution</h2>';
        // Prepare the editor for a new image
        $html .= '<div id="isImgS1"></div>';
        // Init the editor in node isImgSd1
        $html .= ' <script async type="module">';
        $html .= 'import  {IsImgSolution} from "./index.js"; ';
        $params = array('id' => 'isImgS1', 'height' => 0, 'width' => 0, 'plhHeight' => 80, 'plhWidth' => 80,
                        'storeButtonId' => 'storeEditor', 'responseId' => "editorResponse");
        $paramsJson = json_encode($params, true);
        $html .= 'let imgSolution = new IsImgSolution(\''.$paramsJson.'\'); ';
        $html .= 'imgSolution.init('.$imgRepId.')';
        $html .= '</script>';
        return $html;
    }
    */
    /**
     * Displays a page with an image editor whose content has id $id in Timgedreps
     * Used to change an already created content
     */
    private function editExisting(int $id) {
        $_SESSION['currChange'] = $id;
        // Get the info 
        $sql = 'SELECT name, json FROM Timgedreps WHERE id=:id';
        $stmt = self::$pdoDB->prepare($sql);
        $stmt->execute(array(':id' => $id));
        $content = $stmt->fetch();
        $initParamsJson = $content['json'];
        $imgName = $content['name'];

        // Builf HTML
        $html = '';
        // Prepare the editor for an existing image
        $html .= '<form method="POST" action = "index.php">';
        $html .= '<label for "imgName">Image name: </label>';
        $html .= '<input type="text" name ="imgName" value="'.$imgName.'" id="imgName" autofocus="autofocus"/>';
        $html .= '<div class="spacer"></div>';
        $html .= '<div id="isImgEd1"></div>';// This is the original button. It will be replaced by JS. 
        $html .= '<div class="spacer"></div>'; 
        $html .= '<input type="submit" class="button" name="update" value="Update">';
        $html .= '<input type="submit" class="button" name="escape" value="Escape">';

        // Init the editor in node isImgEd1
        $html .= ' <script type="module">';
            $html .= 'import  {isImedInstances} from "./modularJS/imgEditor.js"; ';
            $params = array('id' => 'isImgEd1', 'height' => 0, 'width' => 0,
                            'plhHeight' => 80, 'plhWidth' => 80, 'sessname' => 'snxxx' );
            $paramsJson = json_encode($params, true);
            $html .= 'let imgEditor = isImedInstances.create("IsImgEditor", "imgEditor", \''.$paramsJson.'\'); ';
            $html .= 'imgEditor.init(\''.$initParamsJson.'\'); ';
            $html .= 'imgEditor.replaceSubmitButtons(["update"]); ';
        $html .= '</script>';

        $html .= '<input type="hidden" name="repid" value="'.$id.'"/)';
        $html .= '</form>';
        return $html;
    }
    private function tryout(int $id) {
        $_SESSION['currAnswer'] = $id;
        // Get the info 
        $sql = 'SELECT name, json FROM Timgedreps WHERE id=:id';
        $stmt = self::$pdoDB->prepare($sql);
        $stmt->execute(array(':id' => $id));
        $content = $stmt->fetch();
        $initParamsJson = $content['json'];
        $imgName = $content['name'];

        $html = '';
        $html .= '<h2>Question '.$imgName.'</h2>';
        $html .= '<form method="POST" action = "index.php">';
        // Prepare the editor for a new image
        $html .= '<div id="isImgQ1"></div>';
        $html .= '<div class="spacer"></div>'; 
        $html .= '<input type="submit" class="button" name="correct" value="Correct">';
        $html .= '<input type="submit" class="button" name="escape" value="Escape">';

        // Init the editor in node isImgEd1
        $html .= ' <script async type="module">';
            $html .= 'import  {isImedInstances} from "./modularJS/imgEditor.js"; ';
            $params = array('id' => 'isImgQ1', 'height' => 0, 'width' => 0,
                            'plhHeight' => 80, 'plhWidth' => 80, 'sessname' => 'snxxx' );
            $paramsJson = json_encode($params, true);
            $html .= 'let imgQuestion = isImedInstances.create("IsImgQuestion", "imgQuestion", \''.$paramsJson.'\'); ';
            // Load an existing image
            $html .= 'imgQuestion.init(\''.$initParamsJson.'\'); ';
            $html .= 'imgQuestion.replaceSubmitButtons(["correct"]); ';
        $html .= '</script>';
        
        return $html;

    }
    /**
     * Produces json for the correction using jsons of student and teacher answer
     */
    private function correct(string $studentJson, string $teacherJson):string {
        $studentAnswer = json_decode($studentJson, true);
        $teacherAnswer = json_decode($teacherJson, true);
        $correctedAnswer = $studentAnswer;
        $studentPlaceholders = $studentAnswer['imgContainer']['placeholders'];
        $teacherPlaceholders = $teacherAnswer['imgContainer']['placeholders'];
        $correctedPlaceholders = $correctedAnswer['imgContainer']['placeholders'];
        foreach ($correctedPlaceholders as $key => $placeholder) {
            if (trim($studentPlaceholders[$key]['content']) == '') {
                $correctedPlaceholders[$key]['eval'] = 0;
            } elseif (trim($studentPlaceholders[$key]['content']) == trim($teacherPlaceholders[$key]['content'])) {
                $correctedPlaceholders[$key]['eval'] = 1;    	                
            } else {
                // No answer given
                $correctedPlaceholders[$key]['eval'] = -1;
            }
        }
        $correctedAnswer['imgContainer']['placeholders'] = $correctedPlaceholders;
        $correctionJson = json_encode($correctedAnswer);
        return $correctionJson;
    }
    private function correction(int $id) {
        // Get the info 
        $sql = 'SELECT name, json FROM Timgedreps WHERE id=:id';
        $stmt = self::$pdoDB->prepare($sql);
        $stmt->execute(array(':id' => $id));
        $content = $stmt->fetch();
        $teacherParamsJson = $content['json'];
        $imgName = $content['name'];
        $correctionParamsJson = $this->correct($_POST['imedJson'], $teacherParamsJson);

        $html = '';
        $html .= '<h2>Correction '.$imgName.'</h2>';
        $html .= '<form method="POST" action = "index.php">';
        // Prepare the editor for a new image
        $html .= '<div id="isImgAnswer"></div>';
        $html .= '<div class="spacer"></div>'; 
        $html .= '<input type="submit" class="button" name="solution" value="Solution">';
        $html .= '<input type="submit" class="button" name="escape" value="Escape">';

        // Init the editor in node isImgEd1
        $html .= ' <script async type="module">';
            $html .= 'import  {isImedInstances} from "./modularJS/imgEditor.js"; ';
            $params = array('id' => 'isImgAnswer', 'height' => 0, 'width' => 0,
                            'plhHeight' => 80, 'plhWidth' => 80, 'sessname' => 'snxxx' );
            $paramsJson = json_encode($params, true);
            $html .= 'let imgQuestion = isImedInstances.create("IsImgAnswer", "imgAnswer", \''.$paramsJson.'\'); ';
            // Load an existing image
            $html .= 'imgQuestion.init(\''.$correctionParamsJson.'\'); ';
            $html .= 'imgQuestion.replaceSubmitButtons(["solution"]); ';
        $html .= '</script>';

        $_SESSION['currCorrection'] = $id; // Set the id for the benefit of self::solution
        return $html;
    }
    private function solution(int $id) {
        // Get the info 
        $sql = 'SELECT name, json FROM Timgedreps WHERE id=:id';
        $stmt = self::$pdoDB->prepare($sql);
        $stmt->execute(array(':id' => $id));
        $content = $stmt->fetch();
        $teacherParamsJson = $content['json'];
        $imgName = $content['name'];

        $html = '';
        $html .= '<h2>Solution '.$imgName.'</h2>';
        $html .= '<form method="POST" action = "index.php">';
        // Prepare the editor for a new image
        $html .= '<div id="isImgSolution"></div>';
        $html .= '<div class="spacer"></div>'; 
        $html .= '<input type="submit" class="button" name="escape" value="Escape">';

        // Init the editor in node isImgEd1
        $html .= ' <script async type="module">';
            $html .= 'import  {isImedInstances} from "./modularJS/imgEditor.js"; ';
            $params = array('id' => 'isImgSolution', 'height' => 0, 'width' => 0,
                            'plhHeight' => 80, 'plhWidth' => 80, 'sessname' => 'snxxx' );
            $paramsJson = json_encode($params, true);
            $html .= 'let imgQuestion = isImedInstances.create("IsImgSolution", "imgSolution", \''.$paramsJson.'\'); ';
            // Load an existing image
            $html .= 'imgQuestion.init(\''.$teacherParamsJson.'\'); ';
            $html .= 'imgQuestion.replaceSubmitButtons(["solution"]); ';
        $html .= '</script>';

        return $html;
    }
     /**
     * The stored representation has the following structure
     * 
     *      {
     *          origin: <IsImgEditor or IsImgQuestion>,
     *          imgContainer: {
     *              baseImage: <Server name of the image holding the answers as placeholders>,
     *              height: <intrinsic height of the base image>,
     *              width: <intrinsic width of the base image>,
     *              ratio: <quotient of intrinsic width / intrinsic height>,
     *              magFactor: <factor by which intrinsic dimensions are multiplied for display>,
     *              placeholders: [
     *                  {
     *                      type: <plhImgT or plhTxtT>,
     *                      content: <server name of the image or text>,
     *                      fullRect: {
     *                          top: <left uppercorner y intrinsic coordinate with respect to base image>,
     *                          left: <left uppercorner x intrinsic coordinate with respect to base image>,
     *                          height: <height of placeholder in intrinsic coordinates>,
     *                          width: <width of placeholder in intrinsic coordinates>
     *                      }
     *                  },
     *                  {
     *                  },
     *                  ...
     *              ]
     *          }
     *      }
     * 
     * The json transmitted in $_POST['editorResponse] has the following structure
     * 
     *      {
     *          representationId: <the id in Timgedreps for asn update, 0 for a new entry>,
     *          representatin: <the stored representation as described above>
     *      }
     */
    private function body():string {
        $html = '';
        $html .= '<body>';
        $html .= '<h1>ImgEditor</h1>'; 
        /*
        // Set fake POST
        if (isset($_POST['editorResponse']) && $_POST['editorResponse'] != 'undefined') {
            $json = json_decode($_POST['editorResponse'], true);
            $representationId = $json['representationId'];
            $representation = $json['representation'];
            if ($representation['origin'] == 'IsImgQuestion') {
                $_POST['storeQuestion'] = 'Store';
            } elseif ($representation['origin'] == 'IsImgEditor') {
                $_POST['storeEditor'] = 'Store';
            }
        }       
        if (isset($_POST['newImg'])) {
            $html .= $this->showEditor();
        } elseif (isset($_POST['edit'])) {
            // Show the editor with the required image ready for editing
            $html .= $this->showEditor($_POST['edit']);
        } elseif (isset($_POST['tryout'])) {
            $html .= $this->showQuestion($_POST['tryout']);
        } elseif (isset($_POST['storeQ'])) {
            $html .= $this->displayStudentAnswer($representationId);
        } elseif (isset($_POST['store'])) {
            // Click on 'store' in editor for a new image.
            // $_POST['imedJson'] is a hidden POST with a json for the whole result of editing a new image
            $sql = 'INSERT INTO Timgedreps SET name=:name, json=:json';
            $stmt = self::$pdoDB->prepare($sql);
            $stmt->execute(array(':name' => $_POST['imgName'], ':json' => $_POST['imedJson']));
            $html .= $this->imageList();
        } else {
            $html .= $this->imageList();
        }
        */

        // Detect the required action by POST and default to image list
        if (isset($_POST['newImg'])) {
            // New image clicked. Show image editor
            $html .= $this->editNew();
        } elseif (isset($_POST['store'])) {
            // Store clicked in image editor. Store and return to image list
            // $_POST['imedJson'] is a hidden POST with a json for the whole result of editing a new image
            $sql = 'INSERT INTO Timgedreps SET name=:name, json=:json';
            $stmt = self::$pdoDB->prepare($sql);
            $stmt->execute(array(':name' => $_POST['imgName'], ':json' => $_POST['imedJson']));
            $html .= $this->imageList();
        } elseif (isset($_POST['update'])) {
            $sql = 'UPDATE Timgedreps SET name=:name, json=:json WHERE id=:id';
            $stmt = self::$pdoDB->prepare($sql);
            $stmt->execute(array(':name' => $_POST['imgName'], ':json' => $_POST['imedJson'], ':id' => $_SESSION['currChange']));
            unset($_SESSION['currChange']);
            $html .= $this->imageList();
        } elseif (isset($_POST['correct'])) {
            $html .= $this->correction($_SESSION['currAnswer']);
            unset($_SESSION['currAnswer']);
        } elseif (isset($_POST['solution'])) {
            $html .= $this->solution($_SESSION['currCorrection']);
            unset($_SESSION['currCorrection']);
        } elseif (isset($_POST['available'])) {
            // One of the submits in the list of available representations clicked.
            // Detect which one
            foreach ($_POST as $key => $value) {
                if (substr($key, 0, 2) == 'e_') {
                    $id = intval(substr($key, 2));
                    $html .= $this->editExisting($id);
                } elseif (substr($key, 0, 2) == 't_') {
                    $id = intval(substr($key, 2));
                    $html .= $this->tryout($id);
                }
            }
        } else {
            // This is the default. We reach it with any unhandled submit button
            $html .= $this->imageList();
        }
        $html .= '</body>';
        return $html;
    }
    public function render():string {
        $html = '';
        $html .= '<!DOCTYPE html>'; 
        $html .= '<html lang="en">';
        $html .= $this->header();
        $html .= $this->body();
        $html .= '</html>';
        return $html;
    }
}
session_start(); // In isTest it is a named session.
$editor = new ImgEditor();
echo $editor->render();