import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import './Navbar.css';
export default function Navbar(){const navigate=useNavigate();useLocation();const token=localStorage.getItem('token');return <nav className="navbar se-nav"><Link className="logo" to="/products"><span>S</span> ShopEasy.</Link><NavLink to="/products">Explore</NavLink><NavLink to="/cart">Bag</NavLink>{token?<button onClick={()=>{localStorage.removeItem('token');navigate('/login');}}>Sign out</button>:<NavLink to="/login">Sign in</NavLink>}</nav>}
