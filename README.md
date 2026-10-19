# DreamYard: MERN clothing store (local build)

`server/` is the Express + MongoDB Atlas API. `client/` is the React storefront and the hidden admin area.

## 1. Set up MongoDB Atlas
1. Create a free cluster, then **Database Access** → add a user with a password.
2. **Network Access** → add your current IP (or `0.0.0.0/0` for testing).
3. **Connect → Drivers** → copy the connection string and put your database name (e.g. `dream-yard`) before the `?`.

## 2. Run it (two terminals)

**Terminal 1: server**
```bash
cd server
cp .env.example .env     # then edit MONGO_URI, ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET
npm install
npm run dev              # http://localhost:5000
```

**Terminal 2: client**
```bash
cd client
npm install
npm run dev              # http://localhost:5173
```

On the first start with an empty database, the server adds 5 sections and 10 sample products (illustrated garment images in `client/public/samples`). Set `AUTO_DEMO_DATA=false` in `server/.env` to turn this off.

## Admin
Open **http://localhost:5173/admin** and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `server/.env`.
There is no link to it anywhere in the store. To change the address, set `VITE_ADMIN_PATH=my-secret-path` in `client/.env`.

From the admin you can:
- **Products**: add, edit, delete, hide/show, mark as featured, set stock, upload a photo or paste a URL.
- **Sections**: create, rename, reorder, delete (the shop menu and filters follow automatically).
- **Orders**: view details, move through placed → shipped → delivered, cancel (stock is returned), delete.
- **Site settings**: store name, announcement bar, home headline, footer and contact details.

Uploaded photos are saved in `server/uploads/`.

## Structure
```
server/src
  config/ models/ controllers/ (+ admin/) routes/ middleware/ utils/
client/src
  api/ context/ components/ layouts/ pages/ admin/ styles/
```
==============================================================================
 INDIGO LOOM  -  COMPLETE PROJECT GUIDE
 What every file does, how to change it, what happens if you delete it,
 and how to remove the sample (demo) data.
==============================================================================

CONTENTS
  1. The big picture (how the pieces fit together)
  2. Words you will see (small glossary)
  3. IMPORTANT: "the seed folder" - what it was and what replaced it
  4. HOW TO REMOVE ALL SAMPLE DATA (step by step, in the right order)
  5. File-by-file guide: SERVER (the backend)
  6. File-by-file guide: CLIENT (the website + admin page)
  7. Quick safety table: what is safe to delete, what is not
  8. "I want to change X" - where to edit (cookbook)
  9. Common problems and fixes


==============================================================================
 1. THE BIG PICTURE
==============================================================================

The project has two separate programs that talk to each other, plus a database
that lives online in MongoDB Atlas.

   Your browser
       |
       |  opens http://localhost:5173
       v
   CLIENT  (folder: client/)           <- React website. What people see.
       |                                  Includes the hidden admin page.
       |  every time it needs data, it calls  /api/...
       |  (the file client/vite.config.js forwards these calls)
       v
   SERVER  (folder: server/)           <- Express program on port 5000.
       |                                  Applies rules, checks the admin
       |                                  login, reads/writes the database.
       v
   MONGODB ATLAS (online)              <- Where the real data lives:
                                          products, sections, orders,
                                          site settings.

Two very important facts:

  * The DATA (products, orders, ...) is stored in Atlas, NOT in the code
    files. Deleting a code file does not delete data, and deleting data in
    the admin page does not delete code files.

  * The CLIENT never talks to the database directly. It always goes through
    the SERVER. That is why the server needs your Atlas password and the
    client does not.

Uploaded product photos are saved inside the folder server/uploads/ on your
computer. The database only remembers the photo's address, e.g.
/uploads/1730000000-ab12cd.jpg.


==============================================================================
 2. WORDS YOU WILL SEE
==============================================================================

API ............ The list of web addresses the server answers, such as
                 /api/products. The client asks, the server replies with data.
Route .......... One address + what should happen at that address.
Controller ..... The code that does the work for a route (e.g. "save this
                 product").
Model .......... A description of what one kind of record looks like in the
                 database (e.g. a Product has a name, price, stock...).
Middleware ..... Code that runs BEFORE a controller, e.g. "is this person
                 logged in as admin?".
Component ...... A reusable piece of the website screen (a button, a card).
Page ........... A component that fills a whole screen (Home, Shop...).
Context ........ Information shared by the whole website (the shopping bag,
                 the site settings).
Proxy .......... client/vite.config.js tells the client's dev program to pass
                 /api and /uploads requests to the server on port 5000.
.env file ...... A private settings file (passwords, database link). It is
                 never shared or uploaded. You create it by copying
                 .env.example.
Section ........ What the shopper sees as a category: Sarees, Shirts, etc.
                 (In the code it is called "Category".)
Slug ........... The URL-friendly version of a name:
                 "Indigo Ikat Saree" -> indigo-ikat-saree.


==============================================================================
 3. IMPORTANT: "THE SEED FOLDER" - WHAT IT WAS AND WHAT REPLACED IT
==============================================================================

In the FIRST versions of this project there was a folder
    server/src/seed/        (containing seed.js)
and a command  "npm run seed"  that you had to run by hand to fill the
database with sample products.

In the CURRENT version that folder and that command NO LONGER EXIST.
If you still see a "seed" folder, you are looking at an older download -
use the newest indigo-loom.zip.

What exists now instead (these are the "sample data" pieces):

  (a) server/src/utils/demoData.js
        The LIST of sample sections and sample products (names, prices,
        descriptions). Just data written as code.

  (b) server/src/utils/bootstrap.js
        Runs automatically every time the server starts. It looks at the
        database: "are there ZERO products AND ZERO sections?" If yes, it
        copies the list from demoData.js into the database. If the database
        already has anything, it does nothing.

  (c) server/.env  ->  AUTO_DEMO_DATA=true
        The on/off switch for (b). Set it to false and the server will never
        add sample data.

  (d) client/public/samples/*.svg   (10 picture files)
        The illustrated garment pictures that the sample products point to.

So "both places" = the SERVER side (a, b, c) and the CLIENT side (d).

The sample data exists in THREE separate forms, and you must understand
this to remove it properly:

     1. The code list ........ demoData.js
     2. The pictures ......... client/public/samples/
     3. The COPIES IN YOUR DATABASE ... created the first time you started
                                         the server. THIS is what you see in
                                         the shop and in the admin page.

Deleting 1 or 2 does NOT remove 3. See the next section.


==============================================================================
 4. HOW TO REMOVE ALL SAMPLE DATA  (follow the order!)
==============================================================================

!!  THE TRAP TO AVOID  !!
If you delete all products and all sections while AUTO_DEMO_DATA is still
"true", the database becomes empty, and the NEXT time the server restarts it
will add the sample data AGAIN. So do STEP 1 FIRST.

------------------------------------------------------------------
 STEP 1 - Turn off automatic sample data
------------------------------------------------------------------
 Open  server/.env  and set:

        AUTO_DEMO_DATA=false

 Save, then stop the server (Ctrl+C in its terminal) and start it again
 with  npm run dev.

------------------------------------------------------------------
 STEP 2 - Remove the sample records from the database
------------------------------------------------------------------
 Choose ONE of the two ways.

 WAY A - Through the admin page (safest, no Atlas needed)
   1. Go to http://localhost:5173/admin and sign in.
   2. Products page: click "Delete" on each of the 10 sample products and
      confirm each time.
   3. Sections page: click "Delete" on each of the 5 sections
      (Sarees, Shirts, Kurtas, Trousers, Scarves).
      NOTE: a section can only be deleted when it has no products. That is
      why products go first. If you see "Move or delete the N products in
      this section first", delete those products.
   4. Site settings page: replace the sample texts (announcement bar, home
      headline, footer note) with your own, then Save.
   5. Orders page: delete any test orders you placed while trying the shop.

 WAY B - Through MongoDB Atlas (fastest for wiping everything)
   1. Open Atlas -> Database -> your cluster -> "Browse Collections".
   2. Open the database "indigo-loom".
   3. For the collections "products" and "categories": click the collection,
      then delete all documents (or use the trash icon to drop the whole
      collection - the server re-creates it automatically when needed).
   4. Optionally do the same for "orders" (test orders).
   5. The "settings" collection holds ONE document with your site texts.
      Delete it if you want the texts to go back to the built-in defaults,
      or leave it and edit it in the admin page.

 Check: open http://localhost:5173 - the home page should show
 "Featured pieces will appear here." and the Shop should say nothing
 matches. That means the database is clean.

------------------------------------------------------------------
 STEP 3 - Delete the sample pictures (safe only AFTER step 2)
------------------------------------------------------------------
 Delete the folder:   client/public/samples

 If you delete it while sample products still exist in the database, those
 products will show broken/missing images. After step 2 nothing points to
 these pictures any more, so it is safe.

------------------------------------------------------------------
 STEP 4 (optional) - Remove the sample code
------------------------------------------------------------------
 This is only tidying. Skipping it is harmless as long as AUTO_DEMO_DATA is
 false.

 4a. Replace the ENTIRE content of  server/src/utils/bootstrap.js  with:

        import { getSettings } from "./settings.js";

        // Makes sure the site-settings record exists. Runs on every start.
        export async function bootstrap() {
          await getSettings();
        }

 4b. Now you may delete  server/src/utils/demoData.js

     !! Do 4a BEFORE 4b. If you delete demoData.js while bootstrap.js still
     imports it, the server will crash on start with:
         "Cannot find module '.../demoData.js'"

 4c. In server/.env.example you may delete the two lines about
     AUTO_DEMO_DATA. (In server/src/config/env.js the line
     "autoDemoData: ..." becomes unused; leaving it does no harm.)

------------------------------------------------------------------
 STEP 5 - Add your own real content
------------------------------------------------------------------
 In the admin page: create your Sections first, then add Products
 (upload a photo for each). Then edit Site settings.

------------------------------------------------------------------
 What about the decorative colored cloth shapes on the home page?
------------------------------------------------------------------
 The three overlapping patterned panels at the top of the home page and the
 patterned squares behind each section name are NOT sample data. They are
 pure CSS decoration made by client/src/components/Swatch.jsx and the list
 TILE_SWATCHES in client/src/pages/Home.jsx. They are not stored anywhere
 and are not affected by any of the steps above. To change or remove them,
 see section 8 ("Home page decoration").


==============================================================================
 5. FILE-BY-FILE GUIDE: SERVER  (folder: server/)
==============================================================================

Format for each file:
   WHAT IT IS
   HOW TO CHANGE IT
   IF YOU DELETE IT

------------------------------------------------------------------------
 server/.env.example
------------------------------------------------------------------------
 WHAT IT IS
   A template of the private settings the server needs. Copy it to a new
   file named ".env" (same folder) and fill in the values:
     PORT ............ port the server listens on (default 5000)
     NODE_ENV ........ "development" while testing locally
     MONGO_URI ....... your MongoDB Atlas connection string
     CLIENT_ORIGIN ... address of the website allowed to call the server
     ADMIN_EMAIL ..... email used to sign in to the admin page
     ADMIN_PASSWORD .. password used to sign in to the admin page
     JWT_SECRET ...... a long random text used to sign login tokens
     AUTO_DEMO_DATA .. true/false, adds sample data on an empty database
 HOW TO CHANGE IT
   Edit the template only to document new settings. Real values go in .env.
 IF YOU DELETE IT
   Nothing breaks. You only lose the reminder of which settings exist.

------------------------------------------------------------------------
 server/.env   (you create this; it is not in the zip)
------------------------------------------------------------------------
 WHAT IT IS
   Your real secrets. NEVER share it or upload it to GitHub (the file
   server/.gitignore already protects it).
 HOW TO CHANGE IT
   Edit, save, then RESTART the server (Ctrl+C, npm run dev). The server
   reads this file only when it starts.
     - New admin password: change ADMIN_PASSWORD.
     - Log everyone out of admin immediately: change JWT_SECRET.
     - Atlas password changed: update the password inside MONGO_URI. If the
       password contains special characters such as @ : / # ? they must be
       URL-encoded (@ becomes %40, # becomes %23, etc.).
 IF YOU DELETE IT
   The server stops at start-up with "Missing environment variables".

------------------------------------------------------------------------
 server/.gitignore
------------------------------------------------------------------------
 WHAT IT IS
   Tells Git not to upload node_modules, .env, and uploaded photos.
 IF YOU DELETE IT
   Nothing breaks locally, but if you later use Git you could accidentally
   publish your passwords. Keep it.

------------------------------------------------------------------------
 server/package.json
------------------------------------------------------------------------
 WHAT IT IS
   The server's "shopping list" of libraries plus the commands you can run:
     npm run dev   -> starts the server and restarts it when files change
     npm run start -> starts the server normally
   Libraries: express (web server), mongoose (talks to MongoDB), cors,
   helmet, compression, express-rate-limit (safety), jsonwebtoken (admin
   login tokens), multer (photo uploads), dotenv (reads .env), morgan
   (prints a log of requests), nodemon (auto-restart in dev).
 HOW TO CHANGE IT
   Normally you do not edit it by hand. Add a library with
   "npm install <name>" and it updates itself.
 IF YOU DELETE IT
   npm install and npm run dev stop working. The server cannot start.

------------------------------------------------------------------------
 server/uploads/   (folder)  and  server/uploads/.gitkeep
------------------------------------------------------------------------
 WHAT IT IS
   Where photos you upload in the admin page are saved. .gitkeep is an
   empty file whose only job is to keep the empty folder in Git.
 HOW TO CHANGE IT
   Do not rename. The location is set in server/src/middleware/upload.js.
 IF YOU DELETE A PHOTO INSIDE IT
   Any product using that photo shows a missing image.
 IF YOU DELETE THE WHOLE FOLDER
   Photo uploads fail with an error until the folder is re-created.
   Existing photos are lost. Keep the folder.
 NOTE
   Photos you paste as a web link (URL) are not stored here.

------------------------------------------------------------------------
 server/src/server.js      (the START BUTTON)
------------------------------------------------------------------------
 WHAT IT IS
   The first file that runs. In order: loads settings -> connects to Atlas
   -> runs bootstrap -> starts listening on the port -> handles a clean
   shutdown when you press Ctrl+C.
 HOW TO CHANGE IT
   Rarely needed. Port is changed in .env, not here.
 IF YOU DELETE IT
   The server cannot start (npm run dev points at this file).

------------------------------------------------------------------------
 server/src/app.js      (the ROUTE MAP + SAFETY LAYER)
------------------------------------------------------------------------
 WHAT IT IS
   Builds the Express app. It switches on security headers (helmet),
   compression, CORS (who may call the server), a general speed limit
   (240 requests per minute per visitor), a request log, and serves the
   /uploads folder as web addresses. Then it connects each group of
   addresses to its route file:
        /api/health        -> quick "is the server alive" check
        /api/products      -> routes/productRoutes.js
        /api/categories
        /api/settings      -> routes/storeRoutes.js
        /api/orders        -> routes/orderRoutes.js
        /api/admin/...     -> routes/adminRoutes.js
 HOW TO CHANGE IT
   - Change the general rate limit: the "limit: 240" number.
   - Add a brand new group of routes: import its route file and add
     app.use("/api/yourname", yourRoutes).
 IF YOU DELETE IT
   The server cannot start.

------------------------------------------------------------------------
 server/src/config/env.js
------------------------------------------------------------------------
 WHAT IT IS
   Reads the .env file once, checks that the required values exist
   (MONGO_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD), and exports them as
   one tidy object that other files import.
 HOW TO CHANGE IT
   To add a new setting: add its name to the "required" list (if it is
   mandatory) and add it to the exported "env" object, then use env.thatName
   in other files.
 IF YOU DELETE IT
   Nearly every server file imports it, so the server crashes on start.

------------------------------------------------------------------------
 server/src/config/db.js
------------------------------------------------------------------------
 WHAT IT IS
   One function that connects to MongoDB Atlas using your MONGO_URI and
   waits up to 10 seconds for a reply.
 HOW TO CHANGE IT
   Raise "serverSelectionTimeoutMS" if your internet is slow.
 IF YOU DELETE IT
   Server cannot connect to the database, so it cannot start.

------------------------------------------------------------------------
 MODELS  (server/src/models/)  - the shape of each stored record
------------------------------------------------------------------------
 Each model becomes one "collection" (like a spreadsheet) in Atlas.

 Product.js     -> collection "products"
   Fields: name, slug, category (the slug of a section), price, fabric,
   description, sizes (list), image (address of the picture), stock,
   featured (shown on home page), published (visible in the store).
   HOW TO CHANGE: to add a new field (for example "color") see section 8,
   "Add a new field to products".
   IF YOU DELETE: products can no longer be saved or shown; public shop and
   admin product pages fail.

 Category.js    -> collection "categories"   (the "sections")
   Fields: name, slug, order (position in menus).
   IF YOU DELETE: the menu, filters, and the admin Sections page fail.

 Order.js       -> collection "orders"
   Fields: customer (name, email, phone, address, city, pincode), items
   (product, name, size, quantity, price at the time of purchase), total,
   status (placed / shipped / delivered / cancelled).
   HOW TO CHANGE: to add a status, add it to the "enum" list here AND in
   controllers/admin/orderAdmin.js AND client/src/admin/pages/OrdersAdmin.jsx
   (and a colour in admin.css, class .badge--yourstatus).
   IF YOU DELETE: checkout and admin Orders fail.

 Settings.js    -> collection "settings" (only ever ONE document)
   Fields: storeName, announcement, heroTitle, heroSubtitle, footerNote,
   contactEmail, contactPhone. The values written here as "default" are
   what the site shows before you edit anything in the admin page.
   HOW TO CHANGE: edit the default texts here. To add a new editable text,
   add a field here, then add its name to FIELDS in
   controllers/admin/settingsAdmin.js and in
   client/src/admin/pages/SettingsAdmin.jsx, then use it on the website
   through useSite().settings.
   IF YOU DELETE: site texts, the home page and the footer lose their data.

------------------------------------------------------------------------
 ROUTES  (server/src/routes/)  - "address -> which controller function"
------------------------------------------------------------------------
 productRoutes.js
   GET /api/products         list products (public, only "published" ones)
   GET /api/products/:slug   one product page
   DELETE IT -> the shop shows nothing.

 storeRoutes.js
   GET /api/categories       list sections
   GET /api/settings         site texts (announcement, hero, footer)
   DELETE IT -> menu, filters, home page texts fail.

 orderRoutes.js
   POST /api/orders          place an order. Limited to 20 orders per
                             15 minutes per visitor (change "limit: 20").
   DELETE IT -> customers cannot place orders.

 adminRoutes.js
   All the admin addresses. /api/admin/login is open (but limited to 10
   tries per 15 minutes). Everything AFTER the line
   "router.use(requireAdmin)" demands a valid admin login token.
   HOW TO CHANGE: to add a new admin action, add a controller function
   and register it here BELOW the requireAdmin line (so it is protected).
   DELETE IT -> the admin page can no longer log in or save anything.

------------------------------------------------------------------------
 PUBLIC CONTROLLERS  (server/src/controllers/)
------------------------------------------------------------------------
 productController.js
   listProducts: filters by section, search text, featured, and sort
   order (newest / price low-high / price high-low). Only returns
   products marked "published".
   getProduct: finds one product by slug.
   CHANGE: add more sort options in the SORTS list at the top.

 storeController.js
   Returns the list of sections and the site settings.

 orderController.js    (the checkout brain)
   1. Checks the delivery details (valid email, phone 8-15 digits,
      6-digit pincode).
   2. Looks every product up in the database and uses the DATABASE price,
      never the price sent by the browser (so nobody can cheat the price).
   3. Reduces stock safely; if one item lacks stock, it puts back what it
      already took and shows a clear message.
   4. Saves the order.
   CHANGE: the pincode rule is India-specific (6 digits). Edit the "bad"
   check near the top for other countries. Maximum quantity per item is 10
   (look for Math.min(10, ...)).

------------------------------------------------------------------------
 ADMIN CONTROLLERS  (server/src/controllers/admin/)
------------------------------------------------------------------------
 authController.js
   login: compares the email/password with ADMIN_EMAIL/ADMIN_PASSWORD in
   .env (using a timing-safe comparison) and returns a token valid for
   12 hours. CHANGE the duration: expiresIn: "12h".

 productAdmin.js
   Create / edit / delete / list-all products for the admin page.
   buildFields() is the single place where product details from the form
   are cleaned and checked (name required, valid price, section must
   exist, sizes turned into a list, stock never negative).
   CHANGE: add new product fields in buildFields().

 categoryAdmin.js
   Create / rename / reorder / delete sections. Deleting is blocked while
   products still use the section.

 orderAdmin.js
   List orders, change status, delete orders. Cancelling an order puts the
   stock back. A cancelled order cannot be changed again.

 settingsAdmin.js
   Saves the site texts. The list FIELDS says which texts may be changed.

 dashboardAdmin.js
   stats: the numbers on the admin Dashboard (revenue, order count, low
   stock = 5 or fewer left, etc.). CHANGE the low-stock number: "$lte: 5".
   upload: the function that answers after multer has saved a photo.

 DELETING any of these breaks the matching admin screen (and the server
 will not start, because adminRoutes.js imports all of them).

------------------------------------------------------------------------
 MIDDLEWARE  (server/src/middleware/)
------------------------------------------------------------------------
 auth.js
   requireAdmin: the bouncer. Checks that a request carries a valid admin
   token. Without it every admin address answers "Sign in to continue".
   DELETE -> server will not start; and if you removed its use from the
   routes, the admin addresses would be OPEN TO EVERYONE. Never remove it.

 error.js
   asyncHandler: lets controllers fail cleanly. notFound: answer for
   unknown addresses. errorHandler: turns technical errors into friendly
   messages (duplicate name, bad ID, file too big...). CHANGE: edit the
   messages here.
   DELETE -> server will not start.

 upload.js
   Settings for photo uploads: allowed types (JPG, PNG, WebP, GIF), maximum
   size 5 MB, random file names, and the folder location. CHANGE the size:
   "5 * 1024 * 1024" (and the matching words in error.js: "5 MB").
   DELETE -> server will not start.

------------------------------------------------------------------------
 UTILS  (server/src/utils/)  - small helpers
------------------------------------------------------------------------
 slugify.js
   Turns a name into a URL-friendly slug and makes sure it is unique
   ("saree", "saree-2", ...). DELETE -> adding products/sections fails.

 settings.js
   getSettings(): fetches the one settings record, creating it if it does
   not exist yet. DELETE -> server will not start.

 bootstrap.js        (SAMPLE-DATA SWITCH, see section 3)
   Runs on every start. Makes sure the settings record exists and, only if
   AUTO_DEMO_DATA is true AND the database has no products and no sections,
   inserts the sample data.
   CHANGE/REMOVE: see section 4, step 4a.
   DELETE -> server will not start unless you also remove the line in
   server.js that imports and calls it.

 demoData.js         (SAMPLE DATA LIST, see section 3)
   The 5 sample sections and 10 sample products (names, prices, text).
   CHANGE: edit the list to change what a FRESH, EMPTY database gets.
   Changing it does nothing to data already in the database.
   DELETE -> safe ONLY after step 4a of section 4. Otherwise the server
   crashes on start.


==============================================================================
 6. FILE-BY-FILE GUIDE: CLIENT  (folder: client/)
==============================================================================

------------------------------------------------------------------------
 client/.env.example
------------------------------------------------------------------------
 WHAT: template with  VITE_ADMIN_PATH=admin
 USE IT: copy to client/.env, set VITE_ADMIN_PATH=my-secret-path, then
   RESTART the client (npm run dev). The admin page is then at
   http://localhost:5173/my-secret-path
 DELETE: nothing breaks; the admin stays at /admin.

------------------------------------------------------------------------
 client/index.html
------------------------------------------------------------------------
 WHAT: The single HTML page the browser loads. It holds the tab title,
   description, theme color, favicon link, the Google Fonts link, and an
   empty <div id="root"> where React draws the whole site, plus the line
   that loads src/main.jsx.
 CHANGE: edit the <title> and meta description for your store name (these
   two are fixed text; the logo text on the site comes from the admin
   Site settings). To change fonts, edit the Google Fonts link here and the
   font names in src/styles/tokens.css.
 DELETE: the website shows a blank page. Never delete.

------------------------------------------------------------------------
 client/package.json
------------------------------------------------------------------------
 WHAT: Client libraries (react, react-dom, react-router-dom, vite) and
   commands: npm run dev (start), npm run build (make the final
   production files), npm run preview.
 DELETE: client cannot install or start.

------------------------------------------------------------------------
 client/vite.config.js
------------------------------------------------------------------------
 WHAT: Settings for the client's dev program. Its important job is the
   proxy: calls to /api and /uploads are forwarded to
   http://localhost:5000 (the server).
 CHANGE: if you change the server PORT in server/.env, change both
   "http://localhost:5000" lines here to match, then restart the client.
 DELETE: the site loads but shows no products ("Can't reach the store
   server"), because the calls never reach the server.

------------------------------------------------------------------------
 client/public/   (files served exactly as they are)
------------------------------------------------------------------------
 favicon.svg
   The small icon in the browser tab. CHANGE: replace the file with your
   own (keep the name, or update the link in index.html).
   DELETE: harmless; the browser shows a default icon.

 samples/*.svg   (10 sample garment pictures)
   Used ONLY by the sample products. To remove, follow section 4.
   Deleting them while sample products exist makes those products show
   missing images.

------------------------------------------------------------------------
 client/src/main.jsx     (the client START BUTTON)
------------------------------------------------------------------------
 WHAT: Starts React, switches on page navigation (BrowserRouter), the site
   settings provider (SiteProvider) and the shopping bag provider
   (CartProvider), and loads the 5 stylesheets.
 CHANGE: the order of the CSS imports matters (tokens first, admin last).
 DELETE: nothing displays.

------------------------------------------------------------------------
 client/src/App.jsx      (the PAGE MAP)
------------------------------------------------------------------------
 WHAT: Says which address shows which page:
      /                -> Home
      /shop            -> Shop
      /product/<slug>  -> one product
      /checkout        -> Checkout
      /<admin path>/*  -> the hidden admin area (AdminApp)
   The admin route is deliberately NOT linked from anywhere on the public
   site.
 CHANGE: add a new public page by creating a file in src/pages/ and adding
   a <Route> inside the <PublicLayout> group (for example an "About" page).
   Then add a link to it in components/Navbar.jsx.
 DELETE: nothing displays.

------------------------------------------------------------------------
 client/src/config.js
------------------------------------------------------------------------
 WHAT: Reads VITE_ADMIN_PATH and exports ADMIN_PATH ("admin" by default)
   and ADMIN_BASE ("/admin").
 DELETE: App.jsx and the admin files break.

------------------------------------------------------------------------
 client/src/api/client.js     (the PHONE LINE to the server)
------------------------------------------------------------------------
 WHAT: Functions the public site uses to ask the server for things:
   api.products(), api.product(slug), api.categories(), api.settings(),
   api.createOrder(). Also two small helpers:
     rupees(n)  -> turns 4200 into "Rs 4,200" style text
     imgSrc(url) -> returns the picture address
 CHANGE: 
   - Currency symbol / number format: edit rupees(). Example for dollars:
       `$${Number(n).toLocaleString("en-US")}`
   - Friendly error texts are in this file.
 DELETE: all public pages break.

------------------------------------------------------------------------
 client/src/context/SiteContext.jsx
------------------------------------------------------------------------
 WHAT: Loads the site settings and section list ONCE when the site opens
   and shares them with every page (store name, announcement, hero text,
   footer, section names). DEFAULTS at the top are shown if the server is
   not reachable.
 CHANGE: edit DEFAULTS for fallback text. To make another setting
   available site-wide, it just needs to exist in the Settings model (the
   whole settings record is shared automatically).
 DELETE: Navbar, Footer, Home, Shop and ProductPage break.

------------------------------------------------------------------------
 client/src/context/CartContext.jsx
------------------------------------------------------------------------
 WHAT: The shopping bag. Add, change quantity, remove, clear, count,
   total, open/close the drawer. It is saved in the visitor's browser
   (localStorage key "indigo-loom-bag") so the bag survives a refresh.
 CHANGE: to reset every visitor's bag after a big change, change the
   KEY text.
 DELETE: bag, product page, checkout break.

------------------------------------------------------------------------
 client/src/layouts/PublicLayout.jsx
------------------------------------------------------------------------
 WHAT: The frame around every public page: announcement bar + top menu
   (Navbar), the page itself, the Footer and the sliding bag (CartDrawer).
   Also scrolls to the top when you change pages. The ADMIN area does not
   use this frame, which is why the admin has no store menu.
 DELETE: public pages lose their menu/footer, or break.

------------------------------------------------------------------------
 client/src/components/   (reusable pieces)
------------------------------------------------------------------------
 Navbar.jsx
   Announcement bar (only appears if the Announcement text is not empty),
   store name/logo text, links (Shop + the first 3 sections), and the Bag
   button with the item count.
   CHANGE: "categories.slice(0, 3)" controls how many section links show.

 Footer.jsx
   Store name, footer note, contact email/phone, copyright year. All text
   comes from admin Site settings.

 ProductCard.jsx
   One product tile in grids: picture, name, fabric, price, "Sold out"
   badge. CHANGE what a tile shows here.

 CartDrawer.jsx
   The bag panel that slides in from the right, with quantity buttons and
   the "Go to checkout" button.

 Swatch.jsx
   Draws the decorative CSS cloth patterns (home page hero panels and
   section tiles). It is only decoration.
   DELETE: Home.jsx imports it, so remove its use there first.

------------------------------------------------------------------------
 client/src/pages/   (public screens)
------------------------------------------------------------------------
 Home.jsx
   Hero (headline + sub-headline from Site settings), "Shop by section"
   tiles (one per section; hidden if you have no sections), and "Weaver's
   picks" (products marked Featured).
   CHANGE: the heading texts "Shop by section" and "Weaver's picks" are
   written directly in this file. TILE_SWATCHES at the top holds the
   decorative patterns/colours.

 Shop.jsx
   All products with section filter buttons, search box (waits 0.3 second
   after you stop typing) and sort menu. Filters live in the web address
   (?category=...&sort=...), so links can be shared.

 ProductPage.jsx
   One product: big picture, price, description, size buttons, Add to bag,
   "Only N left" when stock is 5 or fewer (look for "product.stock < 6").

 Checkout.jsx
   Delivery form + order summary. After success shows the order number
  and empties the bag. Payment defaults to Pay on Delivery. To require
  Razorpay, set RAZORPAY_ENABLED=true and add the Razorpay test/live key ID
  and secret in server/.env; the public checkout key is served by the API.
  With RAZORPAY_ENABLED=false, the current Pay on Delivery flow is unchanged.
  CHANGE the form fields in the FIELDS list (any new field also
   needs to be accepted in server/src/models/Order.js and checked in
   server/src/controllers/orderController.js).

------------------------------------------------------------------------
 client/src/admin/   (the hidden admin area)
------------------------------------------------------------------------
 AdminApp.jsx
   The admin's own page map: login, dashboard, products, sections, orders,
   settings. Contains the guard "RequireAdmin": if there is no saved login
   token, it sends you to the login page. Also adds a "noindex" tag so
   search engines skip it.
   NOTE: this guard only decides what the SCREEN shows. The real security
   is on the server (middleware/auth.js).

 AdminLayout.jsx
   The admin frame: left menu (Dashboard, Products, Sections, Orders, Site
   settings), "View store" link and Sign out button.
   CHANGE: the LINKS list at the top is the menu.

 adminApi.js
   All the admin's calls to the server. It attaches your login token to
   each call, saves/clears the token in the browser, and if the server says
   "not logged in" (token expired), it sends you to the login page.
   CHANGE: when you add a new admin feature on the server, add its call here.

 ProductForm.jsx
   The pop-up form to add/edit a product (name, section, fabric, price,
   stock, sizes, description, photo upload or URL, "visible in store",
   "show on home page").
   CHANGE: default values for a NEW product are in blank() at the top
   (e.g. default sizes "S, M, L, XL", default stock 10).

 pages/Login.jsx            admin sign-in screen
 pages/Dashboard.jsx        number cards + latest 5 orders
 pages/ProductsAdmin.jsx    product table, search, Edit / Hide-Show / Delete
 pages/SectionsAdmin.jsx    add / rename / reorder / delete sections
 pages/OrdersAdmin.jsx      orders table, status menu, details, delete
 pages/SettingsAdmin.jsx    edit store name, announcement, hero text,
                            footer, contact details
   DELETE any of these: its menu link would lead to an error page and
   AdminApp.jsx (which imports it) will not compile. To remove a feature
   properly, delete the file AND its <Route> in AdminApp.jsx AND its entry
   in the LINKS list in AdminLayout.jsx.

------------------------------------------------------------------------
 client/src/styles/   (all the looks; 5 files, loaded in this order)
------------------------------------------------------------------------
 tokens.css      THE CONTROL PANEL FOR THE LOOK. Colours, fonts, text
                 sizes, spacing, rounded corners, shadow. Change one value
                 here and the whole site changes. (See section 8.)
 base.css        Basic page rules: body text, headings, links, the page
                 width (.container), keyboard focus outline, reduced-motion.
 components.css  Buttons, form fields, menu bar, product cards, bag
                 drawer, footer, announcement bar, the fabric swatch
                 patterns, loading placeholders.
 pages.css       Home hero, section tiles, shop toolbar, product page,
                 checkout, plus the mobile layout rules (@media at the
                 bottom).
 admin.css       Everything for the admin area. Its class names start with
                 "adm" or "a-" so it never affects the store.
 DELETE tokens.css or base.css: the site loses its colours/fonts (many
   rules rely on tokens.css variables). Deleting a CSS file also requires
   removing its import line in main.jsx, or the client will not start.


==============================================================================
 7. QUICK SAFETY TABLE
==============================================================================

NEVER DELETE (the project stops working):
   server: src/server.js, src/app.js, src/config/*, src/models/*,
           src/routes/*, src/controllers/*, src/middleware/*,
           src/utils/slugify.js, src/utils/settings.js, package.json, .env
   client: index.html, package.json, vite.config.js, src/main.jsx,
           src/App.jsx, src/config.js, src/api/client.js,
           src/context/*, src/layouts/*, src/components/* (except see
           below), src/pages/*, src/admin/*, src/styles/*
   folder: server/uploads (the folder itself)

SAFE TO DELETE ANY TIME:
   .env.example files, README.md, this guide, client/public/favicon.svg,
   server/uploads/.gitkeep

SAFE TO DELETE ONLY AFTER YOU CLEAN THE DATABASE (section 4):
   client/public/samples/    (the 10 pictures)

SAFE TO DELETE ONLY WITH A CODE EDIT FIRST:
   server/src/utils/demoData.js  -> first replace bootstrap.js (4a)
   server/src/utils/bootstrap.js -> first remove its import + call in
                                    server.js
   client/src/components/Swatch.jsx -> first remove its use in Home.jsx

DATA YOU CAN WIPE FROM ATLAS WITHOUT BREAKING CODE:
   products, categories, orders (server re-creates collections as needed),
   settings (falls back to built-in defaults).


==============================================================================
 8. "I WANT TO CHANGE X"  -  COOKBOOK
==============================================================================

 Change the brand/store name
   Easiest: admin page -> Site settings -> Store name -> Save.
   Also edit by hand: client/index.html (<title> and og:title), the default
   in server/src/models/Settings.js and DEFAULTS in
   client/src/context/SiteContext.jsx.

 Change colours
   client/src/styles/tokens.css
     --indigo / --indigo-deep  main dark blue (buttons, hero, footer)
     --turmeric                yellow accent (announcement bar, key button)
     --madder                  red (errors, delete links)
     --paper / --mist / --line page background / soft panels / borders
     --ink / --ink-soft        text colours
   Save; the page updates instantly.

 Change fonts
   1) Pick fonts at fonts.google.com, copy the <link> into client/index.html
      (replace the existing Google Fonts link).
   2) In tokens.css change --font-display (headings) and --font-body (text).

 Change the home page headline / sub-headline / announcement / footer
   Admin page -> Site settings. No code needed.

 Change the headings "Shop by section" and "Weaver's picks"
   client/src/pages/Home.jsx (search for the text).

 Home page decoration (the cloth panels in the hero)
   - Change their colours/patterns: TILE_SWATCHES in Home.jsx
     (base = main colour, accent = pattern colour, pattern = plain, stripe,
     check or ikat).
   - Replace with a real photo: in Home.jsx replace the whole
     <div className="hero__cloth"> ... </div> block with
       <div className="hero__cloth"><img src="/hero.jpg" alt="" /></div>
     put hero.jpg in client/public/, and add this to pages.css:
       .hero__cloth img { width:100%; height:100%; object-fit:cover;
                          border-radius: var(--radius-m); }

 Add / rename / delete a section (Sarees, Shirts...)
   Admin page -> Sections. The shop menu, filters and home tiles follow.

 Add a product / change price / stock / photo / hide it
   Admin page -> Products. "Hide" removes it from the store without
   deleting it.

 Change the admin address (/admin)
   client/.env  ->  VITE_ADMIN_PATH=something-only-you-know
   restart the client.

 Change the admin email or password
   server/.env -> ADMIN_EMAIL / ADMIN_PASSWORD, restart the server.

 Change how long the admin stays logged in
   server/src/controllers/admin/authController.js -> expiresIn: "12h".

 Change the server port
   server/.env PORT=... AND client/vite.config.js (two proxy lines).

 Change currency (rupee -> something else)
   client/src/api/client.js -> rupees()
   Also the word "Price (Rs)" in client/src/admin/ProductForm.jsx and the
   free-delivery sentence in admin Site settings.

 Change the "low stock" number (currently 5)
   server/src/controllers/admin/dashboardAdmin.js   ($lte: 5)
   client/src/admin/pages/ProductsAdmin.jsx          (p.stock <= 5)
   client/src/pages/ProductPage.jsx                  (product.stock < 6)

 Change the maximum photo size (currently 5 MB)
   server/src/middleware/upload.js (5 * 1024 * 1024)
   and the message text in server/src/middleware/error.js.

 Change the default sizes for new products
   client/src/admin/ProductForm.jsx  (blank() -> sizes)
   server/src/models/Product.js      (sizes default)

 Add a new field to products (example: "color")
   1. server/src/models/Product.js: add   color: { type: String, default: "" },
   2. server/src/controllers/admin/productAdmin.js: in buildFields() add
        color: body.color?.trim() || "",
   3. client/src/admin/ProductForm.jsx: add  color: ""  inside blank(), and
      an input like the Fabric one:
        <label className="label">Color
          <input className="field" value={form.color || ""} onChange={set("color")} />
        </label>
   4. Show it to shoppers: in client/src/pages/ProductPage.jsx add
        {product.color && <p>{product.color}</p>}
   5. Restart the server. Old products simply have an empty color.

 Add a new public page (example: About)
   1. Create client/src/pages/About.jsx exporting a component.
   2. client/src/App.jsx: import it and add <Route path="/about" element={<About />} />
      inside the PublicLayout group.
   3. client/src/components/Navbar.jsx: add <NavLink to="/about">About</NavLink>.

 Change order statuses
   server/src/models/Order.js (enum), server/src/controllers/admin/orderAdmin.js
   (STATUSES), client/src/admin/pages/OrdersAdmin.jsx (STATUSES), and a
   colour in admin.css as  .badge--yourstatus { ... }

 Change pincode / phone rules for other countries
   server/src/controllers/orderController.js (the regular expressions in the
   "bad" check). The checkout form labels are in client/src/pages/Checkout.jsx.

 Change speed limits (protection against abuse)
   general: server/src/app.js ("limit: 240" per minute)
   orders:  server/src/routes/orderRoutes.js ("limit: 20" per 15 minutes)
   admin login: server/src/routes/adminRoutes.js ("limit: 10" per 15 minutes)


==============================================================================
 9. COMMON PROBLEMS AND FIXES
==============================================================================

 "Missing environment variables" when starting the server
   You did not create server/.env. Copy .env.example to .env and fill it.

 Server stops with a MongoDB connection / authentication error
   - Wrong username/password in MONGO_URI (special characters must be
     URL-encoded).
   - Your IP is not allowed: Atlas -> Network Access -> add your IP.
   - No database name or typo before the "?" in the connection string.

 Website shows "Can't reach the store server"
   The server is not running (Terminal 1), or the port differs from the
   one in client/vite.config.js. Open http://localhost:5000/api/health - it
   should show {"ok":true,...}.

 Admin login says "Wrong email or password"
   Use exactly ADMIN_EMAIL / ADMIN_PASSWORD from server/.env. If you
   edited .env, you must restart the server. After 10 wrong tries wait
   15 minutes.

 Admin suddenly returns to the login page
   The 12-hour token expired, or you changed JWT_SECRET. Sign in again.

 Sample products came back after I deleted them
   AUTO_DEMO_DATA was still true and the database was empty at restart.
   Set it to false (section 4, step 1) and delete them again.

 "Cannot find module ... demoData.js"
   You deleted demoData.js before editing bootstrap.js (section 4, 4a).
   Put the file back or apply 4a.

 I cannot delete a section ("Move or delete the N products...")
   Delete or move those products first (edit each and pick another section).

 A product image is broken
   The photo file was deleted from server/uploads or client/public/samples,
   or the pasted URL no longer works. Edit the product and upload again.

 My changes to .env or .env values are ignored
   Restart the program (server or client). Both read these only on start.

 My changes to a code file do not show
   Client files update by themselves in the browser. Server files restart
   automatically (nodemon); if not, stop and run npm run dev again.

==============================================================================
 END OF GUIDE
==============================================================================