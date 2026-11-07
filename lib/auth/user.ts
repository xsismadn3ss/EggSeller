import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type Model,
} from "mongoose"

export interface UserAttrs {
  username: string
  passwordHash: string
  role: string
}

const UserSchema = new Schema<UserAttrs>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 1,
    },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, default: "admin" },
  },
  { timestamps: true }
)

export const User: Model<UserAttrs> =
  (models.User as Model<UserAttrs> | undefined) ??
  model<UserAttrs>("User", UserSchema)

export type UserDocument = HydratedDocument<UserAttrs>
