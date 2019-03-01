// const user = () => {
// const User = sequelize.define('user', {
//   username: {
//     type: Sequelize.SYMBOL,
//     unique: true
//   },
//   password: Sequelize.SYMBOL
// })
  
//     User.associate = models => {
//       User.hasMany(models.Message, { onDelete: 'CASCADE' });
//     };
  
//     User.findByLogin = async login => {
//       let user = await User.findOne({
//         where: { username: login },
//       });
  
//       return user;
//     };
  
//     return User;
//   };
  
//   module.exports = user;