
Installation  
- npm install  
- modify sequelize lib in node_modules  
    - go to node_modules/sequelize/lib/data-types.js  
    - on line 336 change date.format('YYYY-MM-DD HH:mm:ss.SSS Z'); to date.format('YYYY-MM-DD HH:mm:ss.SSS');  

For Dev  
- npm start  
For Prod with pm2  
- go to dist folder  
- pm2 start ecosystem.json  

playground url
http://localhost:3001/

