import { Car } from './car.interface'

export interface CarBuyer {
    carBuyerId: string
    name: string
    cars: Array<Car>
}
