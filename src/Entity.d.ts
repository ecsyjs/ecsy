interface Component {
}

interface ComponentConstructor<T extends Component> {
	new (...args: any): T;
}

export class Entity {
	/**
	 * Get an immutable reference to a component on this entity
   * @param Component Type of component to get
	 */
	getComponent<T extends Component>(Component:ComponentConstructor<T>): T;

	getMutableComponent<T extends Component>(
		Component: ComponentConstructor<T>
	): T;
	addComponent<T extends Component>(
		Component: ComponentConstructor<T>,
		values?: {}
	): this;
	removeComponent<T extends Component>(
		Component: ComponentConstructor<T>,
		forceRemove?: boolean
	): this;
	hasComponent<T extends Component>(
		Component: ComponentConstructor<T>
	): boolean;

	/**
	 * Remove this entity from the world.
	 */
	remove():void;
}
