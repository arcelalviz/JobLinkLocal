import Link from 'next/link';
import { ArrowUpRight, Compass, Route } from 'lucide-react';

export default function NotFound(){
 return <main className="failure-page"><div className="failure-top"><Link href="/" className="brand"><span className="brand-icon"><Route size={19}/></span>joblinklocal</Link><span>THE OPPORTUNITY NETWORK</span></div><div className="failure-content"><span className="eyebrow dark-eyebrow">A WRONG TURN IS NOT THE END</span><div className="failure-number">404<span>↗</span></div><h1>Not every path<br/>leads <em>somewhere.</em></h1><p>That page may have moved. There are plenty of opportunities still ahead.</p><Link className="btn btn-ink" href="/">Back to the beginning <ArrowUpRight size={19}/></Link></div><div className="failure-footer"><Compass size={20}/> THERE'S ALWAYS ANOTHER WAY FORWARD.</div></main>;
}
