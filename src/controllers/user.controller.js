import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';

// function to generate access and refresh tokens
const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    // console.log('user in token gen:', user);

    if (!user) {
      throw new ApiError(404, 'User not found for token generation');
    }

    if (typeof user.generateAccessToken !== 'function') {
      throw new ApiError(500, "User model method 'generateAccessToken' is missing");
    }
    if (typeof user.generateRefreshToken !== 'function') {
      throw new ApiError(500, "User model method 'generateRefreshToken' is missing");
    }

    // generate tokens (support both sync and async implementations)
    const maybeAccess = user.generateAccessToken();
    const accessToken = await Promise.resolve(maybeAccess);
    // console.log('access token:', accessToken);

    const maybeRefresh = user.generateRefreshToken();
    const refreshToken = await Promise.resolve(maybeRefresh);
    // console.log('refresh token:', refreshToken);

    if (!accessToken || !refreshToken) {
      throw new ApiError(500, 'Token generation returned empty token(s)');
    }

    // assign refresh token and save — isolate save in its own try/catch so we can see save errors
    user.refreshToken = refreshToken;
    // console.log('refresh token assigned to user, attempting save...');

    try {
      await user.save({ validateBeforeSave: false });
      // console.log('user.save completed successfully');
    } catch (saveErr) {
      // log full save error and rethrow a useful ApiError
      // console.error('Error saving user after token assignment:', saveErr);
      // preserve original error message for debugging
      throw new ApiError(500, `Failed to persist refresh token: ${saveErr.message || saveErr}`);
    }

    return { accessToken, refreshToken };
  } catch (err) {
    // Log full error for server-side debugging (stack + message)
    // console.error('generateAccessAndRefreshTokens error:', err);

    // If it's already an ApiError, rethrow it unchanged so your controllers keep the same behavior
    if (err instanceof ApiError) throw err;

    // Otherwise wrap while preserving the original message for debugging
    throw new ApiError(500, err?.message || 'Token generation failed');
  }
};


const registerUser = asyncHandler(async (req, res) => {
    // Registration logic here
    // step 1: get user data from frontend
    // step 2: validate user data - not empty, valid email, password strength
    // step 3: check if user already exists in DB - username/email
    // step 4: check for images , chack for avtar
    // step 5: uplodad image to cloudinary , avtar
    // step 6: create user object - crate entry in DB
    // step 7: remove password and refresh token from response
    // step 8: check for user creation success
    // step 9: send response to frontend

    const {fullName, email, username, password} = req.body
    // console.log("fullname:", fullname);

    // check for empty fields
    if( 
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ){
        throw new ApiError(400, 'All fields are required');
    }

    // check if user already exists
    const existedUser = await User.findOne({
        $or: [{email}, {username}]
    })

    if(existedUser){
        throw new ApiError(409, 'User already exists with this email or username');
    }

    // check for images 
    // const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let avatarLocalPath;
    if (
        req.files &&
        Array.isArray(req.files.avatar) &&
        req.files.avatar.length > 0
        ) {
        avatarLocalPath = req.files.avatar[0].path;
    }

    let coverImageLocalPath;
    if(
        req.files && 
        Array.isArray(req.files.coverImage) && 
            req.files.coverImage.length > 0
        ){
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    // console.log(req.files);

    // check for avtar existence
    if(!avatarLocalPath){
        throw new ApiError(400, 'Avatar image is required');
    }

    // upload images to cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar){
        throw new ApiError(500, 'Failed to upload avatar image');
    }

    // create user object
    const user = await User.create({
        fullName,
        email,
        username: username.toLowerCase(),
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
    });

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, 'Failed to create user');
    }

    return res.status(201).json(
        new ApiResponse(201, 'User registered successfully', createdUser)
    );

});

const loginUser = asyncHandler(async (req, res) => {
    // Login logic here
    // step 1: get login data from frontend
    // step 2: email or username
    // step 3: find user in DB
    // step 4: if user found, compare password
    // step 5: access and refresh token generation
    // step 6: send them in cookie and response
   
    const {email, username, password} = req.body;

    if (!(username || email)){
        throw new ApiError(400, 'Username or email is required to login');
    }

    const user = await User.findOne({
        $or: [{email}, {username}]
    })

    if(!user){
        throw new ApiError(404, 'User not found');
    }

    // if (!password) {
    //     throw new ApiError(400, "Password is required");
    // }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401, 'Invalid password');
    }

    //console.log("user found:", user._id);

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id); 

    const loggedInUser= await User.findById(user._id).select(
        "-password -refreshToken"
    );


    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
    .status(200)
    .cookie('accessToken', accessToken, options)
    .cookie('refreshToken', refreshToken, options)
    .json(
        new ApiResponse(200, 'User logged in successfully', {
            user:loggedInUser,
                accessToken,
                refreshToken
        })
    );
});

const logoutUser = asyncHandler(async (req, res) => {
    // Logout logic here
    await User.findByIdAndUpdate(
        req.user._id, 
        { 
            $set:{
                refreshToken: undefined
            }  
        },
        {
            new: true,
        }
    )

    const cookieOptions = {
        httpOnly: true,
        secure: true,
    };

    return res
    .status(200)
    .clearCookie('accessToken', cookieOptions)
    .clearCookie('refreshToken', cookieOptions)
    .json(
        new ApiResponse(200, 'User logged out successfully')
    );
       
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(400, 'unauthorized: no refresh token provided');
    } 

    try {
        // verify refresh token
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET,
        )
    
        const user = await User.findById(decodedToken?._id);
    
        if (!user) {
            throw new ApiError(401, 'invalid refresh token: user not found');
        }
    
        if (user?.refreshToken !== incomingRefreshToken) {
            throw new ApiError(401, 'invalid refresh token: token mismatch');
        }
    
        const options = {
            httpOnly: true,
            secure: true,
        };
    
        const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200) 
        .cookie('accessToken', accessToken, options)
        .cookie('refreshToken', newRefreshToken, options)
        .json(
            new ApiResponse(200, 'Access token refreshed successfully', {
                accessToken,
                newRefreshToken
            })
        );
    
    } catch (error) {
        throw new ApiError(401, error?.message || 'invalid refresh token');
    }
}) 

export { 
    registerUser, 
    loginUser,
    logoutUser,
    refreshAccessToken
};