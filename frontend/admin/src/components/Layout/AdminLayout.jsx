import {Menu} from 'lucide-react'; import CommandPalette from '../common/CommandPalette.jsx';
export default function AdminLayout(){const openMobileDrawer=()=>{}; return <><button onClick={openMobileDrawer}><Menu/></button><CommandPalette/></>}
