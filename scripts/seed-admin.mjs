// Crea o actualiza el usuario administrador inicial.
// Uso: npm run seed:admin  (requiere ADMIN_USERNAME, ADMIN_PASSWORD y
// MONGODB_URI en el entorno; con --env-file=.env se leen desde .env).
import mongoose from "mongoose"
import bcrypt from "bcryptjs"

const { MONGODB_URI, ADMIN_USERNAME, ADMIN_PASSWORD } = process.env

if (!MONGODB_URI) {
  console.error("Falta MONGODB_URI en el entorno")
  process.exit(1)
}
if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
  console.error("Faltan ADMIN_USERNAME y/o ADMIN_PASSWORD en el entorno")
  process.exit(1)
}
if (ADMIN_PASSWORD.length < 8) {
  console.error("ADMIN_PASSWORD debe tener al menos 8 caracteres")
  process.exit(1)
}

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, default: "admin" },
  },
  { timestamps: true }
)
const User = mongoose.models.User ?? mongoose.model("User", UserSchema)

await mongoose.connect(MONGODB_URI)
const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)
const user = await User.findOneAndUpdate(
  { username: ADMIN_USERNAME },
  { $set: { passwordHash, role: "admin" } },
  { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
)
console.log(`Admin listo: ${user.username} (role: ${user.role})`)
await mongoose.disconnect()
