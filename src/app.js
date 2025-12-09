import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const app = express()

app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credentials:true,
}));

// for securety purpose it can allow only specific domains to access cookies
app.use(express.json({
    limit:"16kb"
}));

// for data coming from forms or url's
app.use(express.urlencoded({
    extended:true,
    limit:"16kb"
}));

app.use(express.static("public"));

app.use(cookieParser());

export {app};