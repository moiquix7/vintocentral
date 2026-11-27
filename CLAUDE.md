# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Inventory Management System Church


## Role Agent:
A web developer senior with 25 years the experience.

## General objective

 Create an application web, to manage and inventory the fixed assets of one church, so that one specific user with permissions can register, classify,track and get reports of the assets in a simple way. 

- The application will allow users to add new assets, update existing ones, and generate reports on the inventory status.
- The application will provide a user-friendly interface for managing assets, including features such as search, filter, and sort.
- The application will support multiple users with different roles and permissions, allowing for secure access to the inventory data.

  
## Rules
 
 - apply documentation before every implementation or change
 - code based on High cohesion, low coupling
 - clean code
 - Don't allow excess data.
  - every error, must be controlled.
 - if the route does not exist, make callback to the login page.
 - build a yml file to deploy the application in github page, and configure the firebase.json file to allow the SPA to work properly.
 - 

## Architecture
modular architecture

## Application type
Web

## Technology Stack 
HTML, JavaScript,css, firebase, firebase authentication, firebase firestore, firebase storage.

## INTERFACE STYLE
- soft colors, simple
- eye-friendly.
- Minimalist design, with a focus on usability and accessibility.
- ADHD-friendly mode
- Versatile design, with the ability to switch between light and dark modes.
- automatic adaptation to different screen sizes and devices, including desktops, tablets, and smartphones.
  

## EndUser type
- Old People and young people, with different levels of technical expertise.

## Application Functionalities
- a login page with username and password, with different roles (admin, editor, viewer) and permissions.
- allow users to create, edit, delete (admin only), search, filter, and sort assets by category, department, location, condition, and availability.
- apply key indicators to the dashboard, such as total assets, assets by department, and assets by location, users active/connected. 
- Manage and track the fixed assets of the church.
- Classify assets by categories and tags.
- Classify assets by departments and locations.
- Generate PDF reports on the inventory status, including asset details, location, and condition.
- Provide a dashboard with key indicators on the inventory status, such as total assets, assets by category, and assets by location.
- Allow users to upload images of assets and store them in Firebase Storage.
- allow users to use the camera of the device to take a picture of the asset and upload it to the system.
- The user will be able to inventory-taking process through a grid/table to view and update the status of assets, including their location, condition, and availability.
- Administrators and Editors will be able to see a history of the changes made to the assets, including who made the changes and when. use as a reference for auditing and accountability purposes. the design of the history will be simple and easy to understand, with clear labels and timestamps for each change, in a chronological order. 



### LOGIN PAGE
- The login page will allow users to sign in with their username and password, and will enforce role-based access control to ensure that users only have access to the features and data that they are authorized to view.
- when user is logged in, the system will redirect to the dashboard page, where they can view key indicators on the inventory status and access the different features of the application based on their role and permissions.
- Let user know that must contact to the administrator to create an account if they don't have one, and provide a link to the password reset page if they forget their password. (Display name of the secretary "Luz Andrea Guachalla" of the church who is the administrator of the system, and provide a link to contact them via email or phone.)

### HOME PAGE
- The home page will provide an overview of the inventory status, including key indicators such as total assets, assets by category, and assets by location. 
- DISPLAY in a chronological graph order (eye-friendly) the last 10 assets that have been added or updated, with links to view their details and edit them (if the user has the appropriate permissions). 



### DASHBOARD PAGE
- the dashboard page is available just to administrators and editors, and will provide key indicators on the inventory status, such as total assets, assets by category, assets by department and assets by location, also will show the number of users active/connected to the system, and the number of assets that need attention (e.g., assets that are in poor condition or need maintenance).
- Display a card where the user can see all departments and the number of assets that own every department in a graph chart horizontal.

### INVENTORY-TAKING PAGE
- The inventory-taking page will allow users to view and update the status of assets in a grid/table format, with columns for asset name, category, department, location, condition, and availability.
- Users will be able to update the status of each asset by selecting the appropriate values from dropdown menus or checkboxes, and the system will automatically save the changes to the database.
- The page will also provide a progress indicator to show the number of assets that have been verified and updated, and will allow users to filter and sort the assets by category, department, location, condition, and availability
- also allow users let know the reason why the assets is not available, and provide a field to enter comments or notes about the asset's status.

### RECORDS PAGE
1. The records page will be available just administrators and editors.
2.display three options buttons with navegation to the following: pages:
  2.1. "Tipo de Articulo" (asset type): open a page that displays a list of asset types, with options to create, edit, and delete asset types (admin only).
  2.2 "Departamento" (department): open a page that displays a list of departments, with options to create, edit, and delete departments (admin only).
  2.3 "Ubicacion" (location): open a page that displays a list of locations, with options to create, edit, and delete locations (admin only).
 3. the user will be able to navigate to the different pages based on their role and permissions, and will be able to view and manage the records for each asset type, department, and location.
4. every page will have a search bar to allow users to search for specific records by name or other attributes, and will provide options to filter and sort the records based on different criteria.

### ARTICULOS PAGE
- The articulos page will allow users to view and manage the fixed assets of the church, with options to create, edit, and delete assets (admin and editors only).
- The page will display a list of assets in a grid/table format, with columns for asset name, category, department, location, condition, and availability.
- The grid will have the last column  with buttons to edit and delete the asset (admin and editors only), and will provide options to filter and sort the assets by category, department, location, condition, and availability.
- The user will be able to click on an asset to view its details, including its name, description, category, department, location, condition, availability, and any associated images or documents.


#### REGISTRAR ARTICULO
1. The registrar articulo page will allow users to create a new asset by entering its name, description, category, department, location, condition, availability, and any associated images or documents.
2. The page will populate the department by default with the department of the user who is creating the asset, but will allow users to change it if they have the appropriate permissions.
3. The page will provide options to upload images or documents associated with the asset, and will automatically compress the images before uploading them to Firebase Storage.
4. The fields will have validation rules to ensure that the data entered is valid and complete, and will provide error messages if any required fields are missing or invalid.
5. The page will provide a save button to submit the new asset to the database, and will redirect the user back to the articulos page after the asset has been successfully created.
6. when the user is typing the name of the asset, the system will display a dropdown list of possible matches based on the existing assets in the database. and will be able to select one of the matches to confirm if exists.
7. the save event will be controlled, and if the asset already exists, the system will display a message to let the user know that the asset already exists and will not allow them to create a duplicate record.
8. Fields to fill: Code, name, description,category (tipo articulo),brand,model,Nro Serie,"Empotrado" (checkbox),"Asegurado"(checkbox),department, location, condition, availability, reason for unavailability (if applicable), tags (optional), and up to 4 images (from gallery or camera).


  
## THERMINOLOGY AND GLOSSARY
- "Articulo": any fixed asset of the church, such as furniture, equipment, vehicles, etc.  
- "Departamento": a department or ministry of the church that is responsible for managing a specific category of assets.
- "Ubicacion": the physical location of an asset, such as a room, building, or outdoor area.
- "TIPO DE ARTICULO": a category or type of asset, such as furniture, equipment, vehicles, etc.
- "Etiqueta": a tag or label that can be assigned to an asset for classification or tracking purposes.
- "Usuario": a user of the application, who can have different roles and permissions for managing the assets.
- "IASD": abbreviation for "Iglesia Adventista del Séptimo Día", the Spanish name for the Seventh-day Adventist Church.

## Current state

Static SPA in plain HTML + JavaScript (ES modules, no build step) + CSS, with Firebase Auth / Firestore /
Storage loaded from the CDN (version pinned only in `js/core/firebase.js`). Hash routing (`#/path`).
Node 20.20.2 is pinned with Volta (the machine default is Node 14, which is too old; Volta switches
automatically inside this folder) and is used only for the dev server and tests.

Read `docs/architecture.md` (layers, module rules), `docs/data-model.md` (collections, limits) and
`docs/deployment.md` (Firebase setup, first admin, GitHub Pages) before changing code.
The interface uses the THERMINOLOGY above ("Artículo", never "bien"); its mapping to collections/fields
(Articulo=`assets`, Tipo de artículo=`assetTypes`, Departamento=`categories`, Ubicacion=`locations`) is in
`docs/data-model.md`.
Field lists/limits live in three places that must stay in sync: `js/config/app-config.js`,
the `*.model.js` files, and `firestore.rules` / `storage.rules`.

### Commands
- Dev server: `npm start` (http://localhost:8080)
- All tests: `npm test` (node --test, pure modules only)
- Single test file: `node --test tests/asset.model.test.js`
- Deploy rules: `firebase deploy --only firestore:rules,firestore:indexes,storage`
- Deploy site: push to `main` (GitHub Actions → Pages) or `firebase deploy --only hosting`

### Repository and Database 
url firebase: https://console.firebase.google.com/project/db-vintocentral
repository: https://github.com/moiquix7/vintocentral

