import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';

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

    const {fullname, email, username, password} = req.body
    console.log("fullname:", fullname);

    // check for empty fields
    if( 
        [fullname, email, username, password].some((field) => field?.trim() === "")
    ){
        throw new ApiError(400, 'All fields are required');
    }

    // check if user already exists
    const existedUser = User.findOne({
        $or: [{email}, {username}]
    })

    if(existedUser){
        throw new ApiError(409, 'User already exists with this email or username');
    }

    // check for images 
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

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
        fullname,
        email,
        username: username.toLowerCase(),
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
    });

    const createdUser = await User.findBId(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, 'Failed to create user');
    }

    return res.status(201).json(
        new ApiResponse(201, 'User registered successfully', createdUser)
    );

});

export { registerUser };