import {useState} from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import {describe,it,expect} from 'vitest';
import {InterestBubbles} from './InterestBubbles';
function Fixture(){const [value,setValue]=useState<string[]>([]);return <InterestBubbles label="Interests" catalog={['Basketball','Reading']} value={value} onChange={setValue}/>;}
describe('interest bubbles',()=>{
 it('selects and deselects accessible bubbles',()=>{render(<Fixture/>);const bubble=screen.getByRole('button',{name:'Basketball'});fireEvent.click(bubble);expect(bubble).toHaveAttribute('aria-pressed','true');fireEvent.click(bubble);expect(bubble).toHaveAttribute('aria-pressed','false');});
 it('adds custom interests and matches search without duplicate chips',()=>{render(<Fixture/>);const search=screen.getByRole('textbox');fireEvent.change(search,{target:{value:'Birdwatching'}});fireEvent.click(screen.getByRole('button',{name:'Add “Birdwatching”'}));expect(screen.getByRole('button',{name:'Birdwatching'})).toHaveAttribute('aria-pressed','true');fireEvent.change(search,{target:{value:'birdwatching'}});expect(screen.queryByRole('button',{name:/Add/})).not.toBeInTheDocument();});
 it('supports keyboard custom input',()=>{render(<Fixture/>);fireEvent.change(screen.getByRole('textbox'),{target:{value:'Pottery'}});fireEvent.keyDown(screen.getByRole('textbox'),{key:'Enter'});expect(screen.getByRole('button',{name:'Pottery'})).toHaveAttribute('aria-pressed','true');});
});
